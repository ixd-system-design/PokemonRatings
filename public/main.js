import { createNavigation } from './navigation.js'
import { createListings } from './listings.js'
import { loadCommunityRatings, setRatingVisitor } from './ratings.js'

const nameKey = 'pokemon-reviews.username'
const dialog = document.querySelector('#name-dialog')
const nameInput = document.querySelector('#name-input')
const visitorControl = document.querySelector('.visitor')
const logoutButton = document.querySelector('#logout')

function setVisitor(username) {
    document.querySelector('#visitor-name').textContent = username
    visitorControl.hidden = !username
    setRatingVisitor(username)
    document.querySelector('[popover]:popover-open')?.hidePopover()
}

function promptForName() {
    nameInput.value = ''
    nameInput.setCustomValidity('')
    dialog.showModal()
}

dialog.addEventListener('cancel', event => event.preventDefault())
nameInput.addEventListener('input', () => nameInput.setCustomValidity(''))
document.querySelector('#name-form').addEventListener('submit', event => {
    event.preventDefault()
    const username = nameInput.value.trim()
    if (!username || username.toLowerCase().length > 40) {
        nameInput.setCustomValidity('Enter a name of up to 40 characters.')
        nameInput.reportValidity()
        return
    }
    localStorage.setItem(nameKey, username)
    dialog.close()
    setVisitor(username)
})

logoutButton.addEventListener('click', () => {
    localStorage.removeItem(nameKey)
    setVisitor('')
    promptForName()
})

const communityReady = loadCommunityRatings().catch(error => console.error(error))
const storedName = localStorage.getItem(nameKey)
setVisitor(storedName || '')
if (!storedName) promptForName()

try {
    const response = await fetch('https://pokeapi.co/api/v2/type/?limit=100')
    if (!response.ok) throw new Error(`Pokémon types request failed (${response.status})`)
    const { results } = await response.json()

    // Fetch each type's members in parallel. Pokémon details load on demand.
    const pokemonTypes = await Promise.all(results.map(async ({ url }) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Pokémon type request failed (${response.status})`)
        const { name, pokemon } = await response.json()
        return { name, pokemon: pokemon.map(entry => entry.pokemon) }
    }))
    const typesWithPokemon = pokemonTypes.filter(({ pokemon }) => pokemon.length > 0)
    await communityReady
    typesWithPokemon.forEach(({ name, pokemon }) => createListings(name, pokemon))
    createNavigation(typesWithPokemon)
} catch (error) {
    const message = document.createElement('p')
    message.textContent = 'Could not load Pokémon types. Reload the page to retry.'
    document.querySelector('main').before(message)
    createNavigation([])
    console.error(error)
}
