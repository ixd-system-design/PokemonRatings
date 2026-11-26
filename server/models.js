import mongoose from 'mongoose'

const ratingSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 40
    },
    name: {
        type: String,
        required: true,
        match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    url: {
        type: String,
        required: true,
        match: /^https:\/\/pokeapi\.co\/api\/v2\/pokemon\/[1-9][0-9]*\/$/
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: Number.isInteger
    }
}, { collection: 'pokemon_ratings', versionKey: false })

// Each name can rate a Pokémon once. A Pokémon can have ratings from many names.
ratingSchema.index({ username: 1, name: 1 }, { unique: true })
ratingSchema.index({ name: 1 }) // Look up all ratings for a Pokémon's average.

export const Rating = mongoose.models.Rating || mongoose.model('Rating', ratingSchema)
