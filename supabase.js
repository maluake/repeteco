/* =====================================================
   REPETECO — configuração única do Supabase
   ===================================================== */
(function () {
  const SUPABASE_URL = "https://xhtjrmxkusuqmtpbebzv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_d_2f1B2O-VMeRtp2wg607g_WNUQNcg7";

  if (!window.supabase) {
    console.error("[Repeteco] Supabase JS não foi carregado.");
    return;
  }

  if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }
})();
