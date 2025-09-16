import { NextResponse } from "next/server";
import vm from "vm";
import fetch from "node-fetch";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({
        code: -1,
        msg: "No URL provided",
        processed_time: 0,
        data: {},
      });
    }

    const start = Date.now();
    const html = await fetch(
      `https://snaptik.app/action.php?url=${encodeURIComponent(url)}`,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    ).then((r) => r.text());

    const unpacked = tryUnpackPackedEval(html);

    return NextResponse.json({
      code: 0,
      msg: "success",
      processed_time: (Date.now() - start) / 1000,
      data: {},
      raw: unpacked,
    });
  } catch (error) {
    return NextResponse.json({
      code: -1,
      msg: String(error),
      processed_time: 0,
      data: {},
    });
  }
}

function tryUnpackPackedEval(text) {
  try {
    const str = String(text);

    if (
      !str.includes("eval(function(") &&
      !str.includes("eval (function(")
    ) {
      return null;
    }

    const replaced = str.replace(/eval\s*\(/g, "var __decoded = (");

    const sandbox = {
      __decoded: null,
      decodeURIComponent,
      escape,
      unescape,
      String,
      Math,
      Array,
      Object,
      RegExp,
      Date,
      Number,
      Boolean,
    };

    vm.createContext(sandbox);
    vm.runInContext(replaced, sandbox, { timeout: 2000 });

    return String(sandbox.__decoded || "");
  } catch {
    return null;
  }
}
