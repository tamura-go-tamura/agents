import { NextRequest } from 'next/server'

// 音声分析セッション設定を取得するAPI
export async function GET(request: NextRequest) {
  try {
    // バックエンドのヘルスチェック
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080'
    const healthResponse = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (!healthResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Backend service is not available',
          status: 'offline'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(request.url)
    console.log('WebSocket URL:', url.host);
    

    // WebSocket設定を返す（nginx構成前提）
    return new Response(
      JSON.stringify({ 
        websocket_url: process.env.BACKEND_WS_URL,
        session_config: {
          sample_rate: 16000,
          chunk_size: 4096,
          audio_format: 'pcm'
        },
        backend_status: 'online'
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Backend health check failed:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to connect to backend service',
        status: 'offline'
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// 音声分析セッション開始API
export async function POST(request: NextRequest) {
  try {
    await request.json() // ボディを読み取り（将来の拡張用）
    
    // バックエンドのヘルスチェック
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080'
    const healthResponse = await fetch(`${backendUrl}/health`)
    
    if (!healthResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Backend service is not available' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // WebSocket接続情報を返す
    return new Response(
      JSON.stringify({
        websocket_url: process.env.BACKEND_WS_URL,
        session_config: {
          sample_rate: 16000,
          chunk_size: 4096,
          audio_format: 'pcm'
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
    
  } catch (error) {
    console.error('Audio analysis session setup error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to setup audio analysis session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
