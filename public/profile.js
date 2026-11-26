// If you want 5 of something, you can just "repeat" it 5 times instead of writing it out.
const ratingBalls = '<span class="rating-display-ball"></span>'.repeat(5)

// Pick the first available artwork, with the local Poké Ball as a fallback.
const getProfileImageURL = (pokemon) => {
  const dream_world = pokemon.sprites?.other?.['dream_world']?.front_default
  const official = pokemon.sprites?.other?.['official-artwork']?.front_default
  const home = pokemon.sprites?.other?.['home']?.front_default
  return dream_world || official || home || 'pokeball.svg'
}

// Fetch one Pokémon from PokeAPI and return the HTML for its detail popover.
const createProfile = async (popoverId, url, pokemonName) => {
  const data = await fetch(url)
  if (!data.ok) throw new Error(`Pokémon profile request failed (${data.status})`)
  const pokemon = await data.json()
  const imageURL = getProfileImageURL(pokemon)
  const scores = [1, 2, 3, 4, 5]
  const ratingOptions = scores.map(score => `
          <label class="rating-option">
            <input type="radio" name="${popoverId}-rating" value="${score}">
            <img src="pokeball.svg" alt="${score} out of 5">
          </label>
  `).join('')

  const template = ` 
  <div class="profile">
    <button class="close" popovertarget="${popoverId}"  >Close</button>
    <div class="details"> 
    
      <img class="profile-image" src="${imageURL}" onError="this.src='pokeball.svg'"/>
      <div class="characteristics"> 
        <h2>${pokemon.name}</h2>
        <h3>
          ${pokemon.types.map(t => `<span class="${t.type.name}">${t.type.name}</span>`).join('<i> / </i>')}
        </h3>

        <fieldset>
          <label>Height</label>
          <meter value="${pokemon.height / 10}" min="0" max="10"></meter>
          <label>${pokemon.height / 10}m</label>
        </fieldset>

        <fieldset>
          <label>Weight</label>
          <meter value="${pokemon.weight / 10}" min="0" max="100"></meter>
          <label>${pokemon.weight / 10}kg</label> 
        </fieldset>

        <p>Abilities: ${pokemon.abilities.map(a => a.ability.name).join(', ')}</p>

        <details class="rating-editor" data-pokemon-name="${pokemonName}" data-pokemon-url="${url}">
          <summary class="rating-chip">
            <span class="rating-chip-label">Rating</span>
            <span class="rating-chip-value">
              <span class="rating-chip-average" aria-hidden="true">—</span>
              <span class="rating-display-slot">
                <span class="rating-display" aria-hidden="true">${ratingBalls}</span>
                <span class="rating-spinner" role="status" aria-label="Updating rating"></span>
              </span>
              <span class="rating-count" aria-hidden="true">…</span>
              <span class="rating-announcement" role="status">Loading community rating…</span>
            </span>
            <span class="rating-chevron" aria-hidden="true"></span>
          </summary>
          <h3 class="rating-heading" id="${popoverId}-rating-heading">My rating</h3>
          <fieldset class="rating-fields" aria-labelledby="${popoverId}-rating-heading">
            <div class="rating-options">${ratingOptions}</div>
            <button type="button" class="rating-clear" hidden>Clear rating</button>
          </fieldset>
          <p class="rating-error" role="status"></p>
        </details>
      </div>
    </div>
    <div class="stats">
      ${pokemon.stats.map(stat => `
        <div class="stat">
          <div class="base-stat">${stat.base_stat}</div>
          <div class="stat-name">${stat.stat.name}</div> 
        </div>`).join(' ')}
    </div>
  </div>`
  return DOMPurify.sanitize(template, { ADD_ATTR: ['popovertarget'] })
}


export { createProfile }
