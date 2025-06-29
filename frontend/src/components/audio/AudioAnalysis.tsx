'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, MicOff, Zap, FileText } from 'lucide-react'

// WebSocket接続の状態管理
interface ConnectionState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

// リアルタイム分析結果
interface AnalysisResult {
  risk_level: 'SAFE' | 'WARNING' | 'DANGER'
  confidence: number
  detected_issues: string[]
  intervention_needed: boolean
  timestamp: number
}

// 転写結果
interface TranscriptionResult {
  source: 'user' | 'ai'
  text: string
  timestamp: number
}

export default function AudioAnalysis() {
  const [isListening, setIsListening] = useState(false)
  const [isWarning, setIsWarning] = useState(false)
  const [slimeShape, setSlimeShape] = useState({ scale: 1, rotation: 0, borderRadius: '50%' })
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null
  })
  const [transcript, setTranscript] = useState<TranscriptionResult[]>([])
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResult | null>(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false) // 音声再生状態
  
  // Refs
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const playbackAudioContextRef = useRef<AudioContext | null>(null)

  // ストリーミング音声再生機能
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextStartTimeRef = useRef<number>(0)

  // 音声チャンクを即座に再生する関数
  const playAudioChunk = useCallback(async (audioBase64: string) => {
    try {
      if (!playbackAudioContextRef.current) {
        playbackAudioContextRef.current = new AudioContext({
          sampleRate: 48000,
          latencyHint: 'playback'
        })
      }

      const audioContext = playbackAudioContextRef.current
      
      // Resume AudioContext if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      // Base64デコード
      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
      
      // PCM16データをAudioBufferに変換
      const sampleRate = 24000
      const numberOfFrames = audioData.length / 2
      const audioBuffer = audioContext.createBuffer(1, numberOfFrames, sampleRate)
      const channelData = audioBuffer.getChannelData(0)
      
      // Int16データをFloat32に変換（リトルエンディアン）
      const dataView = new DataView(audioData.buffer)
      for (let i = 0; i < numberOfFrames; i++) {
        const sample16 = dataView.getInt16(i * 2, true)
        channelData[i] = sample16 / 32768.0
      }
      
      // 音声ソースを作成
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      
      // ゲインノードで音量調整
      const gainNode = audioContext.createGain()
      gainNode.gain.value = 0.8
      
      source.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // スケジューリングして連続再生
      const currentTime = audioContext.currentTime
      const startTime = Math.max(currentTime, nextStartTimeRef.current)
      const duration = numberOfFrames / sampleRate
      
      source.start(startTime)
      nextStartTimeRef.current = startTime + duration
      
      // 再生完了後にクリーンアップ
      source.onended = () => {
        const index = audioSourcesRef.current.indexOf(source)
        if (index > -1) {
          audioSourcesRef.current.splice(index, 1)
        }
      }
      
      audioSourcesRef.current.push(source)
      
      console.log(`音声チャンク再生: ${numberOfFrames}サンプル, 開始時刻: ${startTime.toFixed(3)}s`)
      
    } catch (error) {
      console.error('音声チャンク再生エラー:', error)
    }
  }, [])

  const playAudioData = useCallback(async (audioBase64: string) => {
    await playAudioChunk(audioBase64)
  }, [playAudioChunk])

  // 音声ストリーミングを停止
  const stopAudioStreaming = useCallback(() => {
    // 既存の音声ソースを停止
    audioSourcesRef.current.forEach(source => {
      try {
        source.stop()
      } catch {
        // Already stopped
      }
    })
    audioSourcesRef.current = []
    nextStartTimeRef.current = 0
    setIsPlayingAudio(false)
  }, [])

  // WebSocketメッセージ処理
  const handleWebSocketMessage = useCallback((data: {
    type: string
    source?: string
    text?: string
    timestamp?: number
    risk_level?: string
    confidence?: number
    detected_issues?: string[]
    intervention_needed?: boolean
    warning_message?: string
    error?: string
    audio_data?: string // 音声データ（Base64）
    chunk_size?: number // 音声チャンクサイズ
  }) => {
    switch (data.type) {
      case 'session_started':
        console.log('Live session started successfully')
        break
      case 'ai_audio_response':
        console.log('AI音声レスポンス受信')
        if (data.audio_data) {
          playAudioData(data.audio_data) // 受信した音声データを再生
        }
        break
      
      case 'ai_audio_stream':
        console.log('AI音声ストリーム受信:', data.chunk_size, 'bytes')
        if (data.audio_data) {
          setIsPlayingAudio(true) // ストリーミング開始をマーク
          playAudioChunk(data.audio_data) // 音声チャンクを即座に再生
        }
        break
      
      case 'session_error':
        console.error('Session error:', data.error)
        setConnectionState(prev => ({ ...prev, error: data.error || 'Unknown error' }))
        break
    }
  }, [playAudioData, playAudioChunk])

  // WebSocket設定を取得
  const getWebSocketConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/audio-analysis')
      const config = await response.json()
      
      if (!response.ok) {
        throw new Error(config.error || 'Failed to get WebSocket configuration')
      }
      
      if (config.backend_status === 'offline') {
        throw new Error('Backend service is currently offline')
      }
      
      return config
    } catch (error) {
      console.error('Failed to get WebSocket config:', error)
      throw error
    }
  }, [])

  // WebSocket接続機能
  const connectWebSocket = useCallback(async () => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Next.js API Route経由でWebSocket設定を取得
      console.log('Fetching WebSocket config from Next.js API...')
      const config = await getWebSocketConfig()
      console.log('WebSocket config received:', config)
      
      const wsUrl = config.websocket_url
      
      console.log('Connecting to WebSocket via Next.js API:', wsUrl)
      
      const ws = new WebSocket(wsUrl)
      websocketRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnectionState({ isConnected: true, isConnecting: false, error: null })
        
        // セッション開始メッセージを送信（設定から取得した情報を使用）
        ws.send(JSON.stringify({
          type: 'start_session',
          config: {
            language: 'ja-JP',
            model: 'gemini-2.0-flash-live-preview-04-09',
            sample_rate: config.session_config?.sample_rate || 16000
          }
        }))
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setConnectionState({ isConnected: false, isConnecting: false, error: null })
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionState({ 
          isConnected: false, 
          isConnecting: false, 
          error: 'WebSocket接続エラーが発生しました' 
        })
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        } catch (error) {
          console.error('WebSocket message parse error:', error)
        }
      }

    } catch (error) {
      console.error('WebSocket connection failed:', error)
      setConnectionState({ 
        isConnected: false, 
        isConnecting: false, 
        error: 'WebSocket接続に失敗しました' 
      })
    }
  }, [handleWebSocketMessage, getWebSocketConfig])

  const disconnectWebSocket = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
    }
  }, [])

  // 音声データをWebSocketに送信
  const sendAudioChunk = useCallback((audioData: ArrayBuffer) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(audioData)))
      websocketRef.current.send(JSON.stringify({
        type: 'audio_chunk',
        audio_data: base64Data
      }))
    }
  }, [])

  // 音声ストリーミング設定
  const setupAudioStreaming = useCallback(async (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      
      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        
        // Float32からInt16に変換
        const pcm16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF
        }
        
        // ArrayBufferに変換してWebSocketに送信
        sendAudioChunk(pcm16.buffer)
      }
      
      source.connect(processor)
      processor.connect(audioContext.destination)
      
    } catch (error) {
      console.error('Audio streaming setup failed:', error)
    }
  }, [sendAudioChunk])

  // 音声録音処理停止
  const stopAudioRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  // スライムアニメーション
  useEffect(() => {
    if (isListening) {
      const animate = () => {
        const time = Date.now() * 0.003
        const scale = 1 + Math.sin(time) * 0.15 + Math.cos(time * 0.7) * 0.1
        const rotation = Math.sin(time * 0.5) * 5
        const r1 = 45 + Math.sin(time) * 15
        const r2 = 55 + Math.cos(time * 1.2) * 12
        const r3 = 50 + Math.sin(time * 0.8) * 18
        const r4 = 48 + Math.cos(time * 1.5) * 10
        
        setSlimeShape({
          scale,
          rotation,
          borderRadius: `${r1}% ${r2}% ${r3}% ${r4}%`
        })
        
        animationRef.current = requestAnimationFrame(animate)
      }
      animate()
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      setSlimeShape({ scale: 1, rotation: 0, borderRadius: '50%' })
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isListening, isWarning])

  const startListening = async () => {
    try {
      // WebSocket接続
      connectWebSocket()
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      streamRef.current = stream
      
      // 音声ストリーミング設定
      await setupAudioStreaming(stream)
      
      setIsListening(true)
      console.log('音声監視開始...')
      
    } catch (error) {
      console.error('マイクアクセスエラー:', error)
      alert('マイクにアクセスできませんでした。ブラウザの設定を確認してください。')
    }
  }

  const stopListening = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // 音声ストリーミング停止
    stopAudioStreaming()
    
    // 音声録音停止
    stopAudioRecording()
    
    // WebSocket停止メッセージ送信
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'stop_session'
      }))
    }
    
    setIsListening(false)
    setIsWarning(false)
    console.log('音声監視停止')
  }

  // デモ用の文字起こしシミュレーション（開発用）
  const addDemoTranscript = () => {
    const demoTexts = [
      'こんにちは、今日の会議を始めます。',
      'プロジェクトの進捗について話しましょう。',
      '来週の締切について確認したいことがあります。',
      'このタスクは重要な案件です。',
      'チームメンバーの協力をお願いします。',
      '質問があれば遠慮なくどうぞ。'
    ]
    const randomText = demoTexts[Math.floor(Math.random() * demoTexts.length)]
    const transcriptionResult: TranscriptionResult = {
      source: 'user',
      text: randomText,
      timestamp: Date.now()
    }
    setTranscript(prev => [...prev, transcriptionResult])
  }


  // クリーンアップ
  useEffect(() => {
    return () => {
      disconnectWebSocket()
      stopAudioStreaming()
      stopAudioRecording()
    }
  }, [disconnectWebSocket, stopAudioStreaming, stopAudioRecording])

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto h-full flex gap-6">
        {/* 左側：音声監視パネル */}
        <Card className="w-full bg-white/80 border-slate-200/50 backdrop-blur-sm shadow-xl shadow-blue-100/20">
          <CardContent className="p-8 h-full flex flex-col">
            {/* 上部：メインUI（固定レイアウト） */}
            <div className="flex-1 flex flex-col justify-center min-h-0">
              <div className="text-center">
                {/* 中央の円とコントロール（常に同じ位置） */}
                <div className="space-y-6">
                  {/* マイクの円（固定位置） */}
                  <div className="relative">
                    <div className="w-40 h-40 mx-auto relative">
                      {/* 波打つ外側のリング */}
                      <div className={`absolute inset-0 rounded-full transition-all duration-700 ${
                        isListening ? 'animate-pulse' : 'bg-gradient-to-r from-blue-100/40 to-purple-100/40 animate-pulse'
                      } ${
                        isWarning 
                          ? 'bg-gradient-to-r from-red-100/60 to-orange-100/60' 
                          : 'bg-gradient-to-r from-blue-100/60 to-purple-100/60'
                      }`}></div>
                      
                      {/* スライムのように波打つマイクの円 */}
                      <div 
                        className={`absolute inset-6 flex items-center justify-center transition-colors duration-500 shadow-lg ${
                          isListening ? (
                            isWarning 
                              ? 'bg-gradient-to-r from-red-400 to-orange-400' 
                              : 'bg-gradient-to-r from-blue-400 to-purple-400'
                          ) : 'bg-gradient-to-r from-white to-slate-50 border border-slate-100'
                        }`}
                        style={{
                          borderRadius: isListening ? slimeShape.borderRadius : '50%',
                          transform: isListening ? `scale(${slimeShape.scale}) rotate(${slimeShape.rotation}deg)` : 'scale(1)',
                          transition: isListening ? 'none' : 'all 0.5s ease-out'
                        }}
                      >
                        <Mic className={`w-8 h-8 ${
                          isListening ? 
                            (isWarning ? 'text-white animate-bounce' : 'text-white') 
                            : 'text-blue-500'
                        }`} />
                      </div>
                      
                      {/* 装飾的な優しい円（非監視時のみ） */}
                      {!isListening && (
                        <>
                          <div className="absolute -top-2 -right-2 w-4 h-4 bg-purple-300 rounded-full animate-ping"></div>
                          <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-blue-300 rounded-full animate-pulse"></div>
                        </>
                      )}
                      
                      {/* ステータスライト（監視時のみ） */}
                      {isListening && (
                        <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full ${
                          isWarning ? 'bg-red-400 animate-ping' : 'bg-green-400 animate-pulse'
                        }`}></div>
                      )}
                    </div>
                  </div>
                  
                  {/* コントロールエリア（固定高さ） */}
                  <div className="h-32 flex flex-col justify-center space-y-4">
                    {!isListening ? (
                      <>
                        <Button 
                          onClick={startListening}
                          size="lg"
                          className="px-10 py-5 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 border-0 shadow-lg shadow-blue-200/50 transition-all duration-500 hover:shadow-blue-300/60 hover:scale-105 text-white"
                        >
                          <Zap className="w-5 h-5 mr-3" />
                          音声監視を開始
                        </Button>
                        <p className="text-slate-600 text-sm">
                          AI によるリアルタイム音声分析を開始します
                        </p>
                      </>
                    ) : (
                      <>
                        <Button 
                          onClick={stopListening}
                          variant="outline"
                          size="lg"
                          className="px-6 py-3 text-base font-semibold border-red-300 text-red-500 hover:bg-red-50 hover:border-red-400 transition-all duration-300 bg-white shadow-sm"
                        >
                          <MicOff className="w-4 h-4 mr-2" />
                          監視を停止
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
