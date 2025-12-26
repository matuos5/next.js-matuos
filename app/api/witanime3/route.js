import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const episodeUrl = searchParams.get("url");

    if (!episodeUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "يرجى إضافة رابط الحلقة كمعامل في الرابط",
          example: "/api/witanime?url=https://witanime.you/episode/boruto-naruto-next-generations-الحلقة-1/"
        },
        { status: 400 }
      );
    }

    const bypassApi = "https://dark-v2-api.vercel.app/api/v1/tools/bypass?url=";

    const response = await axios.get(
      bypassApi + encodeURIComponent(episodeUrl),
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
          "sec-ch-ua-mobile": "?1",
          "sec-ch-ua-platform": '"Android"',
          "upgrade-insecure-requests": "1",
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "navigate",
          "sec-fetch-user": "?1",
          "sec-fetch-dest": "document",
          "referer": "https://witanime.you/",
          "accept-language": "ar-SY,ar;q=0.9,en-SY;q=0.8,en;q=0.7,en-US;q=0.6"
        },
        responseType: "json"
      }
    );

    if (!response.data?.status) {
      return NextResponse.json(
        {
          success: false,
          error: "فشل في تخطي الحماية",
          message: response.data?.message || "Unknown error"
        },
        { status: 500 }
      );
    }

    const htmlContent = response.data?.data?.fullHtml || response.data?.data?.htmlPreview || "";
    
    if (!htmlContent) {
      return NextResponse.json(
        {
          success: false,
          error: "لم يتم العثور على محتوى HTML"
        },
        { status: 404 }
      );
    }

    const $ = cheerio.load(htmlContent);

    const episodeInfo = {
      title: $("title").text().trim(),
      episodeName: $("h3").first().text().trim(),
      addedDate: $(".fa-calendar-alt").parent().text().trim().replace("أُضيفت في", "").trim()
    };

    const watchServers = [];
    $(".nav-tabs li a.server-link").each((index, element) => {
      watchServers.push({
        id: $(element).data("server-id") || index,
        name: $(element).find(".ser").text().trim(),
        onclick: $(element).attr("onclick") || "",
        element: {
          tag: element.tagName,
          class: $(element).attr("class") || ""
        }
      });
    });

    const downloadServers = [];
    $(".quality-list").each((index, element) => {
      const quality = $(element).find("li:first-child").text().trim();
      const links = [];
      
      $(element).find(".download-link").each((linkIndex, linkElement) => {
        links.push({
          index: $(linkElement).data("index") || linkIndex,
          server: $(linkElement).find(".notice").text().trim(),
          href: $(linkElement).attr("href") || "#",
          rel: $(linkElement).attr("rel") || "",
          element: {
            tag: linkElement.tagName,
            class: $(linkElement).attr("class") || ""
          }
        });
      });
      
      if (quality && links.length > 0) {
        downloadServers.push({
          quality: quality,
          links: links
        });
      }
    });

    const allEpisodes = [];
    $("#ULEpisodesList li a").each((index, element) => {
      const onclick = $(element).attr("onclick") || "";
      const episodeId = onclick.match(/'([^']+)'/)?.[1] || "";
      
      allEpisodes.push({
        number: index + 1,
        title: $(element).text().trim(),
        onclick: onclick,
        encodedId: episodeId,
        isActive: $(element).parent().hasClass("episode-active")
      });
    });

    const result = {
      success: true,
      episodeInfo: episodeInfo,
      watchServers: watchServers,
      downloadServers: downloadServers,
      allEpisodes: {
        count: allEpisodes.length,
        episodes: allEpisodes.slice(0, 10),
        totalEpisodes: allEpisodes.length
      },
      stats: {
        totalWatchServers: watchServers.length,
        totalDownloadLinks: downloadServers.reduce((sum, server) => sum + server.links.length, 0),
        hasNextEpisode: $(".next-episode a").length > 0,
        hasPreviousEpisode: $(".previous-episode a").length > 0
      },
      metadata: {
        url: episodeUrl,
        bypassMethod: response.data?.method || "Unknown",
        timestamp: new Date().toISOString(),
        responseSize: `${(htmlContent.length / 1024).toFixed(2)} KB`
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error("Witanime API Error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: "حدث خطأ داخلي في الخادم",
        details: error.message,
        type: error.name,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
                                          } 
