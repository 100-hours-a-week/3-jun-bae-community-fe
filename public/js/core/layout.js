
const header = `
    <header>
      <nav class="container">
        <ul>
          <li><a href="/index.html" style="font-size: 1.2rem; font-weight: 800; color: var(--pico-primary);">TURING ARENA</a></li>
        </ul>
        <ul>
          <li data-auth="guest"><a href="/pages/login.html" role="button" class="secondary">Log In</a></li>
          <li data-auth="guest"><a href="/pages/signup.html" role="button">Sign Up</a></li>
          <li data-auth="user">
            <details class="dropdown">
              <summary aria-haspopup="listbox">
                <span data-auth-nickname>Account</span>
              </summary>
              <ul role="listbox">
                <li><a href="/pages/useredit.html">Edit Profile</a></li>
                <li><a href="#" data-action="logout" data-redirect="/pages/login.html">Log Out</a></li>
              </ul>
            </details>
          </li>
        </ul>
      </nav>
    </header>
`

const footer = `
<footer class="container">
    <small>© 2025 Turing Arena · Human vs AI</small>
    <small> <a href="/pages/privacy.html">Privacy Policy</a> | <a href="/pages/terms.html">Terms of Service</a></small>
</footer>
`

// layout insert
document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  body.insertAdjacentHTML("afterbegin", header);
  body.insertAdjacentHTML("beforeend", footer);
});