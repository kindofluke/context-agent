import { createDefine } from "fresh";

// This specifies the type of "ctx.state" which is used to share
// data among middlewares, layouts and routes.
export interface State {
  shared: string;
}

export const define = createDefine<State>();

export function getSessionId(req: Request): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=", 2);
    if (k === "session_id") return v;
  }
  return undefined;
}
