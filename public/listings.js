import { createProfile } from './profile.js'
import { openRatingEditor, renderListingRating } from './ratings.js'

function createListing(pokemon, sectionName) {
    // PokeAPI's detail URL includes the numeric sprite ID. Skip alternate forms with missing sprites.
    const id = pokemon.url.split('/').filter(segment => Number(segment)).pop()
    if (id > 10000) return null
    const iconURL = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    const popoverId = `${sectionName}-${pokemon.name}`
    const listing = document.createElement('div')
    listing.className = 'listing'
    listing.dataset.pokemonName = pokemon.name
    const template = `
      <button class="openButton" popovertarget="${popoverId}">
        <img src="${iconURL}" alt="">
        <span>${pokemon.name}</span>
        <span class="rating-badge">
          <span class="rating-badge-average" aria-hidden="true"></span>
          <img class="rating-badge-icon" src="pokeball.svg" alt="">
          <span class="rating-count" aria-hidden="true"></span>
          <span class="rating-announcement"></span>
        </span>
        <img class="open" src="open.svg" alt="">
      </button>
      <div popover id="${popoverId}">
        <p>Loading Pokémon…</p>
      </div>`
    listing.innerHTML = DOMPurify.sanitize(template, { ADD_ATTR: ['popover', 'popovertarget'] })
    const sprite = listing.querySelector('.openButton img')
    sprite.addEventListener('error', () => { sprite.src = 'pokeball.svg' }, { once: true })
    renderListingRating(listing.querySelector('.rating-badge'), pokemon.name)

    const popover = listing.querySelector('[popover]')
    let loadingProfile = false
    popover.addEventListener('toggle', async event => {
        if (event.newState !== 'open' || loadingProfile) return

        if (!popover.querySelector('.profile')) {
            loadingProfile = true
            popover.querySelector('p').textContent = 'Loading Pokémon…'
            try {
                popover.innerHTML = await createProfile(popoverId, pokemon.url, pokemon.name)
            } catch (error) {
                popover.querySelector('p').textContent = 'Could not load this Pokémon. Reopen the profile to retry.'
                console.error(error)
                return
            } finally {
                loadingProfile = false
            }
        }

        if (popover.matches(':popover-open')) openRatingEditor(popover.querySelector('.rating-editor'))
    })
    return listing
}

// Render the Pokémon in one type section.
export function createListings(sectionName, pokemonList) {
    const section = document.createElement('section')
    section.id = sectionName
    section.classList.add(sectionName)
    const listings = pokemonList.map(pokemon => createListing(pokemon, sectionName)).filter(Boolean)
    section.append(...listings)
    document.querySelector('main').appendChild(section)
}
