document.addEventListener("DOMContentLoaded", function () {
  const body = document.body;

  // Cria botão de alternar tema (pode mudar posição no HTML se quiser)
  const toggleThemeBtn = document.createElement("button");
  toggleThemeBtn.textContent = "🌙 Alternar Tema";
  toggleThemeBtn.className = "btn btn-secondary position-fixed bottom-0 end-0 m-3";
  document.body.appendChild(toggleThemeBtn);

  // Aplicar tema salvo
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    body.classList.add("dark-mode");
  }

  // Alternar tema
  toggleThemeBtn.addEventListener("click", function () {
    body.classList.toggle("dark-mode");
    const currentTheme = body.classList.contains("dark-mode") ? "dark" : "light";
    localStorage.setItem("theme", currentTheme);
  });
});
