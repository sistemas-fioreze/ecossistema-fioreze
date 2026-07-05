const status = document.getElementById("adminStatus");

fetch("/api/v1/admin/session", { headers: { accept: "application/json" } })
  .then(async (response) => {
    if (response.status === 401) {
      status.textContent = "Autenticacao sera implementada em fase futura. Nenhum acesso administrativo foi liberado.";
      return;
    }
    const payload = await response.json();
    status.textContent = payload?.ok ? "Sessao local ativa." : "Acesso administrativo indisponivel.";
  })
  .catch(() => {
    status.textContent = "Nao foi possivel verificar a sessao administrativa local.";
  });
