// app/api/snaptik/route.js
export async function GET(req) {
  // util: parse top-level comma-separated args (handles quoted strings and .split('|') simple patterns)
  function parseArgs(top) {
    const args = [];
    let i = 0;
    const len = top.length;
    while (i < len) {
      // skip spaces
      while (i < len && /\s/.test(top[i])) i++;
      if (i >= len) break;

      const ch = top[i];
      if (ch === "'" || ch === '"') {
        // parse quoted string
        const quote = ch;
        i++;
        let buf = "";
        while (i < len) {
          if (top[i] === "\\") {
            // escape
            if (i + 1 < len) {
              buf += top[i + 1];
              i += 2;
              continue;
            } else {
              i++;
              continue;
            }
          }
          if (top[i] === quote) {
            i++;
            break;
          }
          buf += top[i++];
        }
        // check if followed by .split('|') pattern
        while (i < len && /\s/.test(top[i])) i++;
        if (top.slice(i, i + 7) === ".split(") {
          // parse split argument
          i += 7; // skip .split(
          while (i < len && /\s/.test(top[i])) i++;
          const splitQuote = top[i];
          if (splitQuote === "'" || splitQuote === '"') {
            i++;
            let sep = "";
            while (i < len) {
              if (top[i] === "\\") {
                if (i + 1 < len) {
                  sep += top[i + 1];
                  i += 2;
                  continue;
                } else {
                  i++;
                  continue;
                }
              }
              if (top[i] === splitQuote) {
                i++;
                break;
              }
              sep += top[i++];
            }
            // skip ')'
            while (i < len && top[i] !== ")") i++;
            if (i < len && top[i] === ")") i++;
            args.push(buf.split(sep));
          } else {
            // unexpected - push raw string
            args.push(buf);
          }
        } else {
          args.push(buf);
        }

        // skip whitespace and optional comma
        while (i < len && /\s/.test(top[i])) i++;
        if (top[i] === ",") i++;
        continue;
      } else {
        // parse number or identifier or other simple token until comma at top-level
        let token = "";
        while (i < len && top[i] !== ",") {
          // stop at comma but also keep parentheses balanced (so functions won't break here)
          if (top[i] === "(") {
            // capture until matching ) simply
            let depth = 0;
            while (i < len) {
              if (top[i] === "(") depth++;
              else if (top[i] === ")") {
                depth--;
                token += top[i];
                i++;
                if (depth <= 0) break;
                continue;
              }
              token += top[i++];
            }
          } else {
            token += top[i++];
          }
        }
        token = token.trim();
        if (token.length > 0) {
          // try parse number
          const n = Number(token);
          if (!Number.isNaN(n)) args.push(n);
          else args.push(token);
        }
        // skip comma if present
        if (i < len && top[i] === ",") i++;
        continue;
      }
    }
    return args;
  }

  // util: find the full eval(function...)(...) call robustly by scanning and matching parens/brackets/quotes
  function extractEvalCall(s) {
    const key = "eval(function";
    const start = s.indexOf(key);
    if (start === -1) return null;
    let i = start + 4; // position at '(' before function
    // find the opening '(' of eval(
    while (i < s.length && s[i] !== "(") i++;
    if (i >= s.length) return null;

    // We'll scan from i (the '(' after eval) and find the matching closing ')' that ends the eval(...) call.
    const stack = [];
    let inSingle = false;
    let inDouble = false;
    let inBack = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      // handle string states
      if (!inDouble && ch === "'" && !inBack) {
        inSingle = !inSingle;
        continue;
      }
      if (!inSingle && ch === '"' && !inBack) {
        inDouble = !inDouble;
        continue;
      }
      if ((ch === "\\") && (inSingle || inDouble)) {
        // skip escape next char
        inBack = !inBack;
        // toggle back-escape only for this char
        if (inBack) {
          // next iteration will flip it off when we see next char
        } else {
          inBack = false;
        }
        continue;
      } else {
        inBack = false;
      }

      if (inSingle || inDouble) continue;

      if (ch === "(" || ch === "{" || ch === "[") {
        stack.push(ch);
      } else if (ch === ")" || ch === "}" || ch === "]") {
        const last = stack.pop();
        // when stack empty and we encounter a ')' that closes the eval( ... ) initial bracket,
        if (stack.length === 0 && ch === ")") {
          // Now j is at the closing ')' of eval(...). But the code might be like eval(function(...){...})(args)
          // so we need to check if following char is '(' meaning an immediate call of the returned function.
          // We want to include the following "(...)" invocation as part of the whole call.
          let k = j + 1;
          while (k < s.length && /\s/.test(s[k])) k++;
          if (k < s.length && s[k] === "(") {
            // find matching ) for this invocation as well
            const startInvoke = k;
            let depth = 0;
            let inS = false, inD = false, inB = false;
            for (let m = k; m < s.length; m++) {
              const ch2 = s[m];
              if (!inD && ch2 === "'" && !inB) { inS = !inS; continue; }
              if (!inS && ch2 === '"' && !inB) { inD = !inD; continue; }
              if ((ch2 === "\\") && (inS || inD)) { inB = !inB; continue; } else inB = false;
              if (inS || inD) continue;
              if (ch2 === "(") depth++;
              else if (ch2 === ")") {
                depth--;
                if (depth === 0) {
                  // return full slice from start to m (inclusive)
                  return { call: s.slice(start, m + 1), prefixIndex: start, endIndex: m + 1 };
                }
              }
            }
            // if we couldn't find matching, just return upto j
            return { call: s.slice(start, j + 1), prefixIndex: start, endIndex: j + 1 };
          } else {
            // no immediate invocation, return upto j
            return { call: s.slice(start, j + 1), prefixIndex: start, endIndex: j + 1 };
          }
        }
      }
    }
    return null;
  }

  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) {
      return Response.json({ success: false, error: "يرجى إرسال بارامتر url" }, { status: 400 });
    }

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

    const resp = await fetch("https://snaptik.app/abc2.php", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=----WebKitFormBoundaryJS7G2eJPBusA2onQ",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; M2007J20CG) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36",
        Referer: "https://snaptik.app/ar2",
      },
      body,
    });

    const text = await resp.text();

    // Try extracting robust eval(...) call
    let unpacked = null;
    const found = extractEvalCall(text);
    if (found && found.call) {
      try {
        // found.call looks like "eval(function(p,a,c,k,e,d){...})( arg1, arg2, ... )"
        // we want the inner "function(p,a,c,...) { ... }" and the top-level args inside the trailing ()
        // Extract the "function(...){...}" piece between "eval(" and the next ")"
        const insideEvalOpen = found.call.indexOf("eval(");
        let afterEval = found.call.slice(insideEvalOpen + 5).trim(); // should start with "function"
        // find the function block extent: find the "function" then match braces to get full function expression
        const funcStartIndex = afterEval.indexOf("function");
        if (funcStartIndex === -1) {
          // fallback: try to remove leading "eval(" and trailing ")" to get expression to return
          const expr = found.call.replace(/^eval\s*\(/, "").replace(/\)\s*$/, "");
          const fn = new Function(`return ${expr}`);
          const r = fn();
          if (typeof r === "string") unpacked = r;
        } else {
          // get the function expression and the args text after the closing ) of eval(...)
          // find the first '(' that opens the eval(...) args (we already had that), so split using the location of first ')'
          // simpler: find the index of the first occurrence of ")(" which separates eval(func... ) and invocation args
          const sepIndex = found.call.indexOf(")(");
          let funcExpr = null;
          let argsText = null;
          if (sepIndex !== -1) {
            // func part: from start of 'eval(' + 5 until sepIndex+1 (closing paren)
            const funcPart = found.call.slice(found.prefixIndex, found.call.length);
            // But easier: take substring between 'eval(' and the ')' that precedes the invocation '('
            // We'll locate the matching ) that closes eval(...):
            // we can find the first occurrence of 'function' then find the matching closing '}' for the function body, then subsequent ')' belongs to eval.
            // We'll attempt a simpler path: convert the whole found.call by stripping leading "eval" and then evaluate the expression to get the function value.
            const safeExpr = found.call.replace(/^eval\s*\(/, "").replace(/;?\s*$/, "");
            // safeExpr is like "(function(...){...})(args...)" or "function(...){...}(args...)".
            // Create a function that returns that function invocation result — this executes the packer function only.
            const wrapper = `return ${safeExpr}`;
            const fn = new Function(wrapper);
            const result = fn(); // should be the unpacked string
            if (typeof result === "string" && result.length > 0) unpacked = result;
          } else {
            // fallback: attempt to eval the expression after replacing 'eval(' with 'return '
            const safeExpr = found.call.replace(/^eval\s*\(/, "").replace(/;?\s*$/, "");
            const fn = new Function(`return ${safeExpr}`);
            const result = fn();
            if (typeof result === "string" && result.length > 0) unpacked = result;
          }
        }
      } catch (_err) {
        // second fallback: attempt to manually parse args and call the inner function
        try {
          // split into function definition and invocation args
          // remove leading 'eval(' and trailing ')'
          let raw = found.call.replace(/^eval\s*\(/, "");
          raw = raw.replace(/\)\s*$/, "");
          // Now raw is like: function(p,a,c,k,e,d){...}('...',89,'kstring',21,3,15)
          // find the closing brace of function body
          const funcIdx = raw.indexOf("function");
          const braceOpen = raw.indexOf("{", funcIdx);
          if (funcIdx !== -1 && braceOpen !== -1) {
            // find matching closing brace for function body
            let depth = 0;
            let inS = false, inD = false, inB = false;
            let j = braceOpen;
            for (; j < raw.length; j++) {
              const ch = raw[j];
              if (!inD && ch === "'" && !inB) { inS = !inS; continue; }
              if (!inS && ch === '"' && !inB) { inD = !inD; continue; }
              if ((ch === "\\") && (inS || inD)) { inB = !inB; continue; } else inB = false;
              if (inS || inD) continue;
              if (ch === "{") depth++;
              else if (ch === "}") {
                depth--;
                if (depth === 0) {
                  break;
                }
              }
            }
            const funcBodyEnd = j; // position of the '}' that closes function
            const functionText = raw.slice(0, funcBodyEnd + 1); // includes function(...) { ... }
            let remaining = raw.slice(funcBodyEnd + 1).trim(); // should start with '(' invocation
            if (remaining[0] === "(" && remaining[remaining.length - 1] === ")") {
              remaining = remaining.slice(1, -1); // inside invocation args
            }
            // parse args
            const parsedArgs = parseArgs(remaining);
            // build function from functionText
            const theFunc = new Function(`return (${functionText})`)();
            // call it
            const result = theFunc.apply(null, parsedArgs);
            if (typeof result === "string" && result.length > 0) unpacked = result;
          }
        } catch (_err2) {
          // give up on unpacking this way
          unpacked = null;
        }
      }
    }

    const hay = unpacked || text;

    // extract media links
    const urlRegex = /(https?:\/\/[^\s"'<>]+?\.(?:mp4|m4a|webm|m3u8|mp3|mov)(?:\?[^"'<>\s]*)?)/g;
    const links = [];
    let mm;
    while ((mm = urlRegex.exec(hay)) !== null) {
      if (!links.includes(mm[1])) links.push(mm[1]);
    }

    // extra heuristic if none found
    if (links.length === 0) {
      const extraRegex = /(https?:\/\/[^\s"'<>]{30,400}(?:cdn|download|media|video|cdnv|cdn-cgi)[^\s"'<>]*)/gi;
      while ((mm = extraRegex.exec(hay)) !== null) {
        if (!links.includes(mm[1])) links.push(mm[1]);
      }
    }

    return Response.json({
      success: true,
      unpacked: !!unpacked,
      count: links.length,
      links,
    });
  } catch (_err) {
    console.error("snaptik-route error:", _err);
    return Response.json({ success: false, error: String(_err) }, { status: 500 });
  }
}
