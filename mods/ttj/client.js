export const PROTOCOL = "TTJ/1.0.0";

export function createClient(exec, config = {}) {
  const command = config.command ?? "ttjcore";
  if (typeof command !== "string" || !command.trim()
      || !Array.isArray(config.args ?? []) || (config.args ?? []).some(value => typeof value !== "string")) {
    throw new Error("TTJCoreの接続設定が正しくありません。");
  }
  const prefix = [...(config.args ?? [])];
  if (config.profile) prefix.push("--home", config.profile);
  let starting = null;
  async function ensure() {
    if (config.autoStart === false) return;
    if (!starting) starting = exec(command, [...prefix, "ensure"], {timeout:15000}).then(result => {
      if (result.code !== 0) throw new Error("TTJCoreを準備できません。設定画面で実行ファイルと接続先を確認してください。");
    }).catch(() => {
      starting = null;
      throw new Error("TTJCoreを起動できません。設定画面で実行ファイルと接続先を確認してください。");
    });
    await starting;
  }
  return async (method, params = {}) => {
    await ensure();
    let result;
    try { result = await exec(command, [...prefix, "call", method, "--params", JSON.stringify(params)], { timeout: method === "events.wait" ? 30000 : 15000 }); }
    catch { starting = null; throw new Error("TTJCoreを起動できません。接続設定を確認してください。"); }
    let response;
    try { response = JSON.parse(result.stdout); }
    catch { starting = null; throw new Error("TTJCoreに接続できません。設定画面で接続先を確認してください。"); }
    if (response.jsonrpc !== "2.0" || response.protocol !== PROTOCOL || response.id !== 1) {
      throw new Error("TTJCoreのプロトコルまたは応答IDが一致しません。");
    }
    if (response.error) throw new Error(response.error.message || "TTJCoreの処理に失敗しました。");
    if (result.code !== 0 || !Object.hasOwn(response, "result")) throw new Error("TTJCoreの処理が完了しませんでした。");
    return response.result;
  };
}
