// This serverless function defines API endpoints to handle requests for Pokémon ratings, 
// including reading, saving, and deleting ratings.

import { connectDatabase } from '../../server/database.js'
import { Rating } from '../../server/models.js'

export const config = { path: '/api/ratings' }

// Trim spaces and use lowercase so different capitalizations match the same name.
function normalizeUsername(value) {
    if (typeof value !== 'string') return null
    const username = value.trim().toLowerCase()
    return username && username.length <= 40 ? username : null
}

// Return summaries for all rated Pokémon, or one summary when a name is supplied.
async function getCommunityRatings(name) {
    const ratings = await Rating.aggregate([
        ...(name ? [{ $match: { name } }] : []),
        { $group: { _id: '$name', average: { $avg: '$rating' }, count: { $sum: 1 } } },
        { $project: { _id: 0, name: '$_id', average: 1, count: 1 } }
    ])
    if (!name) return ratings

    const [{ average = null, count = 0 } = {}] = ratings
    return { average, count }
}

// Handle GET requests for reading ratings, PUT for saving, and DELETE for clearing.
export default async (request) => {
    const query = new URL(request.url).searchParams
    const username = normalizeUsername(query.get('username'))
    const name = query.get('name')
    const validName = name && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)

    try {
        
         await connectDatabase()
       
        // GET /api/ratings?name=...&username=... returns the community summary and the visitor's score for one Pokémon.
        // GET /api/ratings?name=... returns the community summary for one Pokémon.
        // GET /api/ratings returns summaries for all rated Pokémon.    
        if (request.method === 'GET') {
            if (query.has('name') && !validName) {
                return Response.json({ error: 'Provide a valid Pokémon name.' }, { status: 400 })
            }

            if (query.has('username')) {
                if (!username || !validName) {
                    return Response.json({ error: 'Provide a valid username and Pokémon name.' }, { status: 400 })
                }

                const [community, personal] = await Promise.all([
                    getCommunityRatings(name),
                    Rating.findOne({ username, name }).select('rating -_id').lean()
                ])
                return Response.json({ ...community, rating: personal?.rating ?? null }, { headers: { 'Cache-Control': 'no-store' } })
            }

            const ratings = await getCommunityRatings(name)
            return Response.json(ratings, { headers: { 'Cache-Control': 'no-store' } })
        }

        // Save or update a visitor's score for one Pokémon and return the new community rating.
        if (request.method === 'PUT') {
            const body = await request.json()
            const username = normalizeUsername(body?.username)
            const { name, url, rating } = body ?? {}
            if (!username || typeof name !== 'string' || typeof url !== 'string'
                || !Number.isInteger(rating) || rating < 1 || rating > 5) {
                return Response.json({ error: 'Provide a name, Pokémon, and whole-number rating from 1 to 5.' }, { status: 400 })
            }
            const item = { username, name, url, rating }
            await Rating.validate(item) 
            await Rating.init() // Wait for the unique index before upserting.
            const { upsertedCount } = await Rating.updateOne(
                { username, name },
                { $set: { url, rating } },
                { upsert: true, runValidators: true }
            )
            // after editing the rating, refresh the Pokémon's community summary and return it
            let community = null
            try {
                community = await getCommunityRatings(name)
            } catch (error) {
                console.error('Community rating calculation after change failed:', error.name)
            }
            return Response.json({ ...item, community }, { status: upsertedCount ? 201 : 200 })
        }

        // Remove a visitor's score for one Pokémon and return the remaining community rating.
        if (request.method === 'DELETE') {
            if (!username || !validName) {
                return Response.json({ error: 'Provide a valid username and Pokémon name.' }, { status: 400 })
            }

            await Rating.deleteOne({ username, name })
            // after deleting the rating, refresh the Pokémon's community summary and return it
            let community = null
            try {
                community = await getCommunityRatings(name)
            } catch (error) {
                console.error('Community rating calculation after change failed:', error.name)
            }
            return Response.json({ community })
        }

        // If the request method is not GET, PUT, or DELETE, return a 405 Method Not Allowed response.
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, PUT, DELETE' } })

    } catch (error) {
        // Handle errors from database connection, validation, or other unexpected issues.
        if (error instanceof SyntaxError) {
            return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
        }
        if (error.name === 'ValidationError') {
            return Response.json({ error: 'Provide a valid Pokémon name and PokeAPI detail URL.' }, { status: 400 })
        }
        console.error(`${request.method} /api/ratings failed:`, error.name)
        return Response.json({ error: 'The ratings request failed.' }, { status: 500 })
    }
}
