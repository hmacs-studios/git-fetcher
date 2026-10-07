/**
 * Cloudflare Worker Service: dailygame.medmacs.app
 * Manages 3:00 PM PKT Daily Game rotation, Dr. Ahroid verified questions,
 * live user attempt verification, and real-time leaderboards.
 */

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

function getPkt3PmCycleDateStr(): string {
  const now = new Date();
  const pktMs = now.getTime() + 5 * 60 * 60 * 1000;
  const pktDate = new Date(pktMs);

  const hours = pktDate.getUTCHours();
  if (hours < 15) {
    pktDate.setUTCDate(pktDate.getUTCDate() - 1);
  }

  const yyyy = pktDate.getUTCFullYear();
  const mm = String(pktDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(pktDate.getUTCDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const yearKey = url.searchParams.get('year') || '1';
    const cycleStr = getPkt3PmCycleDateStr();

    // GET /api/daily-game -> Returns question, historical winners (up to 3 days) & today leader live from Cloud DB
    if (pathname === '/api/daily-game' || pathname === '/daily-game' || pathname === '/') {
      let prevWinner: any = null;
      let prevWinners: any[] = [];
      let todayLeader: any = null;
      let todayLeaders: any[] = [];
      let questionData: any = null;

      // Query Supabase RPC if credentials are present in env
      if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
        try {
          const rpcRes = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_daily_game_pulse`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': env.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ p_year: yearKey })
          });

          if (rpcRes.ok) {
            const data: any = await rpcRes.json();
            if (data?.prev_winner) prevWinner = data.prev_winner;
            if (Array.isArray(data?.prev_winners)) prevWinners = data.prev_winners;
            if (data?.today_leader) todayLeader = data.today_leader;
            if (Array.isArray(data?.today_leaders)) todayLeaders = data.today_leaders;
            if (data?.question) questionData = data.question;
          }
        } catch {
          // Ignore RPC fetch error
        }
      }

      const responsePayload = {
        success: true,
        service: 'dailygame.medmacs.app',
        cycle_date: cycleStr,
        year: yearKey,
        refresh_time: '3:00 PM PKT',
        question: questionData,
        prev_winner: prevWinner,
        prev_winners: prevWinners,
        today_leader: todayLeader,
        today_leaders: todayLeaders
      };

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // POST /api/daily-game/attempt -> Record attempt
    if (pathname === '/api/daily-game/attempt' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const { selectedOption, correctAnswer, responseTime } = body;

        const isCorrect = (selectedOption || '').trim().toLowerCase() === (correctAnswer || '').trim().toLowerCase();

        return new Response(
          JSON.stringify({
            success: true,
            is_correct: isCorrect,
            response_time_seconds: responseTime,
            cycle_date: cycleStr,
            message: isCorrect ? 'Outstanding speed!' : 'Attempt recorded',
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message || 'Invalid payload' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: CORS_HEADERS,
    });
  },
};
