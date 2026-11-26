export function createNavigation(pokemonTypes) {
    const nav = document.querySelector('nav')
    pokemonTypes.forEach(({ name }) => {
        const button = document.createElement('button')
        button.className = name
        button.textContent = name
        button.setAttribute('aria-controls', name)
        button.addEventListener('click', () => {
            nav.querySelectorAll('button').forEach(tab => tab.setAttribute('aria-pressed', tab === button))
            document.querySelectorAll('main > section')
                .forEach(section => section.classList.toggle('active', section.id === name))
        })
        nav.appendChild(button)
    })

    nav.firstElementChild?.click()
}
