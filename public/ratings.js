// Save the visitor's score for a given Pokémon and get the updated community average and count.
async function saveRating(username, name, url, rating) {
    const response = await fetch('/api/ratings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, url, rating })
    })
    if (!response.ok) {
        throw new Error(`Ratings request failed (${response.status})`)
    }
    return response.json()
}

// Remove the visitor's score for one Pokémon and get the remaining community rating.
async function deleteRating(username, name) {
    const query = new URLSearchParams({ username, name })
    const response = await fetch(`/api/ratings?${query}`, { method: 'DELETE' })
    if (!response.ok) {
        throw new Error(`Ratings request failed (${response.status})`)
    }
    return response.json()
}

const communityRatings = new Map()
const unrated = { average: null, count: 0 }
let communityLoaded = false

// Fetch community averages and counts in one batch before drawing the cards.
export async function loadCommunityRatings() {
    const response = await fetch('/api/ratings')
    if (!response.ok) {
        throw new Error(`Ratings request failed (${response.status})`)
    }
    const ratings = await response.json()
    for (const { name, average, count } of ratings) {
        communityRatings.set(name, { average, count })
    }
    communityLoaded = true
}

// Fill in a new card's badge from the ratings already loaded in the browser.
export function renderListingRating(badge, name) {
    const summary = communityRatings.get(name)
    renderCommunityRating(badge, summary === undefined && communityLoaded ? unrated : summary)
}

// Remember a new community rating and update every card for that Pokémon.
function updateCommunityRating(name, summary) {
    communityRatings.set(name, summary)
    const selector = `.listing[data-pokemon-name="${CSS.escape(name)}"] .rating-badge`
    document.querySelectorAll(selector).forEach(badge => renderCommunityRating(badge, summary))
}

const summaryRequests = new WeakMap()

let visitor

// Reset personal scores when the name changes. The community scores are shared.
export function setRatingVisitor(username) {
    visitor = { username, scores: new Map(), pendingScores: new Map() }
}

// A missing score means it has yet to load. A null score means the visitor hasn't rated it.
function syncRatingEditor(editor) {
    const name = editor.dataset.pokemonName
    const saving = visitor.pendingScores.has(name)
    const selected = saving ? visitor.pendingScores.get(name) : visitor.scores.get(name)
    const fields = editor.querySelector('.rating-fields')

    fields.disabled = !visitor.username || !visitor.scores.has(name)
    fields.querySelector('.rating-clear').hidden = !selected
    editor.toggleAttribute('data-saving', saving)
    for (const option of fields.querySelectorAll('input[type="radio"]')) {
        option.checked = Number(option.value) === selected
    }
}

// Set up the picker and load both scores when the profile opens.
export async function openRatingEditor(editor) {
    const currentVisitor = visitor
    const name = editor.dataset.pokemonName
    const wasSaving = currentVisitor.pendingScores.has(name)
    editor.onclick = handleRatingChoice
    editor.onkeydown = handleRatingKey
    editor.open = false
    editor.querySelector('.rating-error').textContent = ''
    syncRatingEditor(editor)

    summaryRequests.get(editor)?.abort()
    const request = new AbortController()
    summaryRequests.set(editor, request)
    editor.setAttribute('data-refreshing', '')

    let summary = null
    try {
        const query = new URLSearchParams({ name, username: currentVisitor.username })
        const response = await fetch(`/api/ratings?${query}`, { signal: request.signal })
        if (response.ok) {
            summary = await response.json()
        }
    } catch {
        // Display an unavailable community rating.
    }
    if (request.signal.aborted) return
    summaryRequests.delete(editor)
    applyRatingSummary(editor, summary)
    if (visitor !== currentVisitor || !editor.closest(':popover-open')) return
    if (summary) updateCommunityRating(name, summary)

    // A save in progress owns the picker until it finishes.
    if (wasSaving || currentVisitor.pendingScores.has(name)) return
    if (summary) {
        currentVisitor.scores.set(name, summary.rating)
        syncRatingEditor(editor)
    } else if (!currentVisitor.scores.has(name)) {
        editor.querySelector('.rating-error').textContent = 'Could not load your rating. Reopen the profile to retry.'
    }
}

// Arrow keys move between scores. Space or Enter picks the focused score.
function handleRatingKey(event) {
    const option = event.target
    if (!option.matches('.rating-option input')) return
    if (event.key === 'Enter') {
        event.preventDefault()
        option.click()
        return
    }
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key]
    if (!step) return

    event.preventDefault()
    const choices = [...event.currentTarget.querySelectorAll('.rating-option input')]
    choices[(choices.indexOf(option) + step + choices.length) % choices.length].focus()
}

// Picking or clearing a score closes the picker and sends the change to the API.
async function handleRatingChoice(event) {
    const option = event.target.closest('.rating-option input, .rating-clear')
    if (!option || option.matches(':disabled')) return
    const editor = event.currentTarget
    const { pokemonName: name, pokemonUrl: url } = editor.dataset
    const rating = option.matches('.rating-clear') ? null : Number(option.value)
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return

    const currentVisitor = visitor
    const alreadySaving = currentVisitor.pendingScores.has(name)
    currentVisitor.pendingScores.set(name, rating)
    syncRatingEditor(editor)
    editor.querySelector('.rating-error').textContent = ''
    editor.open = false
    editor.querySelector('summary').focus({ preventScroll: true })
    if (alreadySaving) return

    let attemptedRating
    let saveError
    let community
    // Finish the current request before sending the latest choice for this Pokémon.
    do {
        attemptedRating = currentVisitor.pendingScores.get(name)
        try {
            const { community: summary } = attemptedRating === null
                ? await deleteRating(currentVisitor.username, name)
                : await saveRating(currentVisitor.username, name, url, attemptedRating)
            currentVisitor.scores.set(name, attemptedRating)
            community = summary ?? null
            saveError = false
        } catch (error) {
            saveError = true
            console.error(error)
        }
    } while (currentVisitor.pendingScores.get(name) !== attemptedRating)

    currentVisitor.pendingScores.delete(name)
    if (visitor !== currentVisitor) return
    if (community !== undefined) updateCommunityRating(name, community)

    // The visitor may have opened another card while the request was in flight.
    const activeEditor = document.querySelector(':popover-open .rating-editor')
    if (activeEditor?.dataset.pokemonName !== name) return
    if (community !== undefined) applyRatingSummary(activeEditor, community)
    syncRatingEditor(activeEditor)
    if (saveError) {
        activeEditor.open = true
        activeEditor.querySelector('.rating-error').textContent = attemptedRating === null
            ? 'Could not clear your rating. Try again.'
            : 'Could not save your rating. Select it again to retry.'
    }
}

// Show the supplied community rating in the profile and stop the spinner.
function applyRatingSummary(editor, summary) {
    // A profile read started before the save can still have the old community score.
    summaryRequests.get(editor)?.abort()
    summaryRequests.delete(editor)
    renderCommunityRating(editor, summary)
    editor.removeAttribute('data-refreshing')
}

// Turn the average and count into visible numbers, Poké Ball fills, and screen reader text.
function renderCommunityRating(container, summary) {
    const average = summary?.average ?? 0
    const count = summary?.count ?? null
    const formattedAverage = count ? average.toFixed(1) : null

    container.querySelector('.rating-badge-average, .rating-chip-average').textContent = formattedAverage ?? '—'
    container.toggleAttribute('data-unrated', !formattedAverage)

    container.querySelectorAll('.rating-display-ball').forEach((ball, index) => {
        const fill = Math.min(1, Math.max(0, average - index))
        ball.style.setProperty('--score-fill', `${fill * 100}%`)
    })
    container.querySelector('.rating-count').textContent = count === null ? '—' : `(${count})`

    let announcement = 'No community ratings yet.'
    if (count === null) announcement = 'Community rating unavailable.'
    if (count) announcement = `Community rating ${formattedAverage} out of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}.`
    container.querySelector('.rating-announcement').textContent = announcement
}
