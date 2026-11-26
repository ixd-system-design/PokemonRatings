# Pokémon Reviews

Browse Pokémon from PokeAPI. Each card shows the community average and rating count. Open a profile and expand the **Rating** chip to see, change, or clear your score. [PokeAPI](https://pokeapi.co)

## Run locally

1. Use Node.js 24 and run `npm ci`.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` to a connection string with your database name. The app also accepts `DATABASE_URL` when `MONGODB_URI` is unset.
3. Run `npm run dev` and open the URL printed by Netlify Dev. [Netlify Dev docs](https://docs.netlify.com/api-and-cli-guides/cli-guides/local-development/)

To deploy on Netlify, import the repo and set `MONGODB_URI` with the Functions scope. The included `netlify.toml` sets the publish directory, functions directory, and Node.js version. [Netlify environment variables](https://docs.netlify.com/build/functions/environment-variables/)

## How the ratings model works

MongoDB stores one document per visitor name and Pokémon in `pokemon_ratings`. Each document has an `_id`, `username`, canonical Pokémon `name`, PokeAPI detail `url`, and integer `rating`. The unique compound index on `{ username: 1, name: 1 }` allows Alex and Sam to rate the same Pokémon and lets each find and update their own score. A separate index on `name` supports the community calculation.

For example, if Alex gives Pikachu a 5 and Sam gives Pikachu a 3, MongoDB matches two Pikachu documents, averages their scores, and returns `{ "average": 4, "count": 2 }`. If Alex changes their score to 4, the average becomes 3.5 and the count stays at two. The profile rounds the average to one decimal place.

A name is required to browse. The browser saves it in local storage. Logout clears it from the browser and opens the prompt again. Saved ratings stay in MongoDB. The API trims names and compares them case-insensitively. Anyone who enters the same name can see and update that name’s ratings in this classroom demo.

## Ratings API

| Method and path | Result |
| --- | --- |
| `GET /api/ratings` | Returns `{ name, average, count }` for each Pokémon with ratings. The browser fetches this batch before rendering cards. |
| `GET /api/ratings?name=pikachu` | Returns `{ average, count }`. An unrated Pokémon returns `{ "average": null, "count": 0 }`. |
| `GET /api/ratings?name=pikachu&username=Alex` | Returns `{ average, count, rating }` for the profile. `rating` is Alex’s score, or `null` if Alex has yet to rate that Pokémon. |
| `PUT /api/ratings` | Takes a JSON body with `username`, `name`, `url`, and `rating`. Returns those fields plus `community: { average, count }`, with status 201 on creation or 200 on update. |
| `DELETE /api/ratings?username=Alex&name=pikachu` | Removes the rating for that name and Pokémon if present. Returns `{ community: { average, count } }` with status 200. |

The server calculates the community rating after a save or deletion. The browser updates the chip from that response. If the change succeeds but the calculation fails, the response has `community: null` and the same success status.
