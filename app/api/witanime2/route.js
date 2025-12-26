import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const animeUrl = searchParams.get("url");
    const limit = parseInt(searchParams.get("limit")) || 50;

    if (!animeUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "أضف رابط الأنمي",
          example: "/api/anime-episodes?url=https://witanime.you/anime/boruto-naruto-next-generations/"
        },
        { status: 400 }
      );
    }

    const bypassResponse = await axios.get(
      `https://dark-v2-api.vercel.app/api/v1/tools/bypass?url=${encodeURIComponent(animeUrl)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    if (!bypassResponse.data?.status) {
      return NextResponse.json(
        {
          success: false,
          error: "فشل في تخطي الحماية"
        },
        { status: 500 }
      );
    }

    const bypassData = bypassResponse.data.data;
    const initialHtml = bypassData.fullHtml || '';
    
    const $ = cheerio.load(initialHtml);
    const episodes = [];

    $('.DivEpisodeContainer').each((index, element) => {
      const $el = $(element);
      const episodeLink = $el.find('a[onclick^="openEpisode"]');
      const onclickAttr = episodeLink.attr('onclick');
      
      if (onclickAttr) {
        const base64Match = onclickAttr.match(/openEpisode\('([^']+)'\)/);
        if (base64Match) {
          try {
            const decodedUrl = Buffer.from(base64Match[1], 'base64').toString('utf-8');
            const episodeTitle = episodeLink.text().trim();
            const episodeNumMatch = episodeTitle.match(/الحلقة\s*(\d+)/i);
            const episodeNum = episodeNumMatch ? parseInt(episodeNumMatch[1]) : 0;
            
            if (episodeNum > 0) {
              episodes.push({
                title: episodeTitle,
                link: decodedUrl,
                episode: episodeNum
              });
            }
          } catch {}
        }
      }
    });

    $('a[onclick^="openEpisode"]').each((index, element) => {
      const $el = $(element);
      const onclickAttr = $el.attr('onclick');
      const episodeTitle = $el.text().trim();
      
      if (onclickAttr && episodeTitle.includes('الحلقة')) {
        const base64Match = onclickAttr.match(/openEpisode\('([^']+)'\)/);
        if (base64Match) {
          try {
            const decodedUrl = Buffer.from(base64Match[1], 'base64').toString('utf-8');
            const episodeNumMatch = episodeTitle.match(/الحلقة\s*(\d+)/i);
            const episodeNum = episodeNumMatch ? parseInt(episodeNumMatch[1]) : 0;
            
            if (episodeNum > 0 && !episodes.some(e => e.episode === episodeNum)) {
              episodes.push({
                title: episodeTitle,
                link: decodedUrl,
                episode: episodeNum
              });
            }
          } catch {}
        }
      }
    });

    const sortedEpisodes = episodes
      .filter((item, index, self) =>
        index === self.findIndex(t => t.episode === item.episode)
      )
      .sort((a, b) => a.episode - b.episode);

    if (sortedEpisodes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "لم يتم العثور على حلقات"
        },
        { status: 404 }
      );
    }

    const maxEpisode = Math.max(...sortedEpisodes.map(e => e.episode));
    const minEpisode = Math.min(...sortedEpisodes.map(e => e.episode));
    const animeTitle = $('h1').first().text().trim() || 'الأنمي';

    const result = {
      success: true,
      anime: animeTitle,
      episodes: {
        count: sortedEpisodes.length,
        range: `${minEpisode} - ${maxEpisode}`,
        list: sortedEpisodes.slice(0, limit)
      },
      pagination: {
        total: sortedEpisodes.length,
        displayed: Math.min(limit, sortedEpisodes.length),
        hasMore: sortedEpisodes.length > limit,
        nextPage: sortedEpisodes.length > limit ? `/api/anime-episodes?url=${encodeURIComponent(animeUrl)}&limit=${limit}&offset=${limit}` : null
      },
      metadata: {
        source: animeUrl,
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "حدث خطأ في الخادم",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
        }
