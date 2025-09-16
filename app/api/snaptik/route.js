// app/api/snaptik/route.js
import { parse } from "acorn";
import estraverse from "estraverse";
import vm from "vm";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) {
      return Response.json(
        { success: false, error: "يرجى إرسال بارامتر url" },
        { status: 400 }
      );
    }

    // body المطلوب للإرسال
    const body = `------WebKitFormBoundaryJS7G2eJPBusA2onQ
Content-Disposition: form-data; name="url"

${url}
------WebKitFormBoundaryJS7G2eJPBusA2onQ
Content-Disposition: form-data; name="lang"

ar2
------WebKitFormBoundaryJS7G2eJPBusA2onQ
Content-Disposition: form-data; name="token"

eyMTc1NzkxNjA1Nw==c
------WebKitFormBoundaryJS7G2eJPBusA2onQ--`;

    // الطلب من snaptik
    const resp = await fetch("https://snaptik.app/abc2.php", {
      method: "POST",
      headers: {
        "Content-Type":
          "multipart/form-data; boundary=----WebKitFormBoundaryJS7G2eJPBusA2onQ",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://snaptik.app/ar2",
      },
      body,
    });

    const text = await resp.text();

    // محاولة استخراج eval أو IIFE من الكود
    let evalNodeSource = null;
    try {
      const ast = parse(text, { ecmaVersion: "latest" });
      estraverse.traverse(ast, {
        enter(node) {
          if (
            node.type === "CallExpression" &&
            node.callee &&
            node.callee.name === "eval"
          ) {
            const arg = node.arguments && node.arguments[0];
            if (arg) {
              evalNodeSource = text.slice(arg.start, arg.end);
              this.break();
            }
          }
          if (
            node.type === "CallExpression" &&
            (node.callee.type === "FunctionExpression" ||
              node.callee.type === "ArrowFunctionExpression")
          ) {
            evalNodeSource = text.slice(node.start, node.end);
            this.break();
          }
        },
      });
    } catch {
      // لو فشل التحليل نتخطى
    }

    // محاولة فكّ الضغط
    let unpacked = null;
    if (evalNodeSource) {
      try {
        const sandbox = {};
        const script = new vm.Script(
          `(function(){ return ${evalNodeSource}; })()`
        );
        const context = vm.createContext(sandbox);
        const result = script.runInContext(context, { timeout: 2000 });
        if (typeof result === "string") {
          unpacked = result;
        } else if (typeof result === "function") {
          try {
            const r2 = result();
            if (typeof r2 === "string") unpacked = r2;
          } catch {
            /* تجاهل */
          }
        }
      } catch {
        /* تجاهل */
      }
    }

    // استخراج الروابط
    const hay = unpacked || text;
    const urlRegex =
      /(https?:\/\/[^\s"'<>]+?\.(?:mp4|m4a|webm|m3u8|mp3|mov)(?:\?[^"'<>\s]*)?)/g;
    const links = [];
    let m;
    while ((m = urlRegex.exec(hay)) !== null) {
      if (!links.includes(m[1])) links.push(m[1]);
    }

    if (links.length === 0) {
      const extraRegex =
        /(https?:\/\/[^\s"'<>]{30,400}(?:cdn|download|media|video|cdnv|cdn-cgi)[^\s"'<>]*)/gi;
      while ((m = extraRegex.exec(hay)) !== null) {
        if (!links.includes(m[1])) links.push(m[1]);
      }
    }

    return Response.json({
      success: true,
      unpacked: Boolean(unpacked),
      count: links.length,
      links,
      debug: text.slice(0, 500) // أول 500 حرف من الرد الخام
    });
  } catch (err) {
    return Response.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
