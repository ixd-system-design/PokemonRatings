import mongoose from 'mongoose'

let connectionPromise

// Reuse an open connection and share one connection attempt across simultaneous requests.
export async function connectDatabase() {
    if (mongoose.connection.readyState === 1) return

    if (!connectionPromise) {
        const uri = process.env.MONGODB_URI || process.env.DATABASE_URL
        if (!uri) throw new Error('MONGODB_URI is not configured')

        connectionPromise = mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5_000,
            maxPoolSize: 5,
            minPoolSize: 0,
            maxIdleTimeMS: 5_000,
        })
            .finally(() => {
                connectionPromise = undefined
            })
    }

    await connectionPromise
}
