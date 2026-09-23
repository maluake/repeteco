/* =====================================================
   REPETECO — cadastro de brechó
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("storeForm");
  if (!form) return;

  form.addEventListener("submit", enviarCadastro);
  preencherDadosUsuario();
});

async function preencherDadosUsuario() {
  if (!window.supabaseClient) return;

  const { data, error } = await window.supabaseClient.auth.getUser();
  if (error) {
    console.error("[Repeteco] Erro ao buscar usuário:", error);
    return;
  }

  const user = data?.user;
  if (!user) return;

  const email = document.getElementById("responsavelEmail");
  const nome = document.getElementById("responsavelNome");

  if (email && !email.value) email.value = user.email || "";
  if (nome && !nome.value) nome.value = user.user_metadata?.nome || "";
}

async function enviarCadastro(event) {
  event.preventDefault();

  const button = document.getElementById("submitBrecho");
  const success = document.getElementById("successMessage");
  const client = window.supabaseClient;

  if (!client) return alert("Não foi possível conectar ao Supabase.");

  if (button) {
    button.disabled = true;
    button.textContent = "enviando...";
  }
  if (success) success.style.display = "none";

  try {
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) {
      throw new Error("Você precisa entrar na sua conta antes de cadastrar um brechó.");
    }

    const user = authData.user;
    const value = id => document.getElementById(id)?.value.trim() || "";

    const nomeBrecho = value("nomeBrecho");
    const descricao = value("descricaoBrecho");
    const cidade = value("cidade");
    const bairro = value("bairro");
    const endereco = value("endereco");
    const responsavelNome = value("responsavelNome");
    const responsavelEmail = value("responsavelEmail") || user.email || "";
    const responsavelWhatsapp = value("responsavelWhatsapp");
    const responsavelInstagram = value("responsavelInstagram").replace(/^@/, "");
    const categorias = [...document.querySelectorAll('input[name="categorias"]:checked')].map(input => input.value);

    if (!nomeBrecho || !cidade || !bairro || !responsavelNome || !responsavelEmail || !responsavelWhatsapp) {
      throw new Error("Preencha os campos obrigatórios antes de enviar.");
    }

    const { data: pendentes, error: buscaError } = await client
      .from("brechos")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .limit(1);

    if (buscaError) console.error("[Repeteco] Erro ao verificar solicitações:", buscaError);
    if (!buscaError && pendentes?.length) {
      throw new Error("Você já possui uma solicitação de brechó aguardando análise.");
    }

    const payload = {
      nome: nomeBrecho,
      descricao: descricao || null,
      cidade,
      bairro,
      endereco: endereco || null,
      categorias,
      user_id: user.id,
      status: "pending",
      nome_responsavel: responsavelNome,
      email_responsavel: responsavelEmail,
      whatsapp: responsavelWhatsapp,
      instagram: responsavelInstagram || null
    };

    const { error: insertError } = await client.from("brechos").insert(payload);
    if (insertError) throw new Error(insertError.message);

    if (success) {
      success.style.display = "block";
      success.textContent = "💚 Solicitação enviada! Agora ela será analisada pela equipe do Repeteco.";
    }

    document.getElementById("storeForm")?.reset();
    const email = document.getElementById("responsavelEmail");
    if (email) email.value = user.email || "";

    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  } catch (error) {
    console.error("[Repeteco] cadastro:", error);
    alert("Não foi possível enviar o cadastro:\n\n" + (error.message || "Ocorreu um erro inesperado."));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "enviar solicitação";
    }
  }
}
