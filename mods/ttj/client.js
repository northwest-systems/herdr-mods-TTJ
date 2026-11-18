export const PROTOCOL = "TTJ/1.0.0";

export function createClient(exec, config = {}) {
  const command = config.command ?? "ttjcore";
  const prefix = config.args ?? [];
  if (typeof command !== "string" || !command.trim()
      || !Array.isArray(prefix) || prefix.some(value => typeof value !== "string")) {
    throw new Error("TTJCoreの接続設定が正しくありません。");
  }
  return async (method, params = {}) => {
    let result;
    try { result = await exec(command, [...prefix, "call", method, "--params", JSON.stringify(params)], { timeout: method === "events.wait" ? 30000 : 15000 }); }
    catch { throw new Error("TTJCoreを起動できません。接続設定を確認してください。"); }
    let response;
    try { response = JSON.parse(result.stdout); }
    catch { throw new Error("TTJCoreに接続できないか、応答が不正です。Coreの起動状態と接続先プロファイルを確認してください。"); }
    if (response.jsonrpc !== "2.0" || response.protocol !== PROTOCOL || response.id !== 1) {
      throw new Error("TTJCoreのプロトコルまたは応答IDが一致しません。");
    }
    if (response.error) throw new Error(response.error.message || "TTJCoreの処理に失敗しました。");
    if (result.code !== 0 || !Object.hasOwn(response, "result")) throw new Error("TTJCoreの処理が完了しませんでした。");
    return response.result;
  };
}