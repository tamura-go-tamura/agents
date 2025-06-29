'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, MicOff, Volume2, Zap, Activity, FileText } from 'lucide-react'

export default function AudioAnalysis() {
  const [isListening, setIsListening] = useState(false)
  const [isWarning, setIsWarning] = useState(false)
  const [slimeShape, setSlimeShape] = useState({ scale: 1, rotation: 0, borderRadius: '50%' })
  const [transcript, setTranscript] = useState<string[]>([
    '音声監視システムが開始されました。',
    '現在の時刻: ' + new Date().toLocaleTimeString(),
    'AI による音声分析を実行中...'
  ])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      // MediaRecorderの設定（実際の実装時に使用）
      mediaRecorderRef.current = new MediaRecorder(stream)
      
      setIsListening(true)
      
      // TODO: 実際のリアルタイム音声分析とGemini連携を実装
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
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    
    setIsListening(false)
    setIsWarning(false)
    console.log('音声監視停止')
  }

  // デモ用の警告シミュレーション（実際の実装では削除）
  const simulateWarning = () => {
    setIsWarning(true)
    setTimeout(() => setIsWarning(false), 3000)
  }

  // デモ用の文字起こしシミュレーション
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
    const timestamp = new Date().toLocaleTimeString()
    setTranscript(prev => [...prev, `[${timestamp}] ${randomText}`])
  }

  // 監視開始時に定期的に文字起こしを追加（デモ用）
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(addDemoTranscript, 3000)
      return () => clearInterval(interval)
    }
  }, [isListening])

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto h-full flex gap-6">
        {/* 左側：音声監視パネル */}
        <Card className="w-1/2 bg-white/80 border-slate-200/50 backdrop-blur-sm shadow-xl shadow-blue-100/20">
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
            
            {/* 下部：ステータス表示（常に固定高さを確保） */}
            <div className="flex-shrink-0 h-20 flex items-center">
              {/* システムステータス（常に表示、監視中のみ内容変更） */}
              <div className="w-full grid grid-cols-3 gap-3">
                <div className={`border rounded-lg p-2 text-center transition-all duration-300 ${
                  isListening 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`text-xs font-semibold ${
                    isListening ? 'text-green-600' : 'text-gray-400'
                  }`}>AI エンジン</div>
                  <div className={`text-xs ${
                    isListening ? 'text-green-500' : 'text-gray-400'
                  }`}>{isListening ? 'オンライン' : 'スタンバイ'}</div>
                </div>
                <div className={`border rounded-lg p-2 text-center transition-all duration-300 ${
                  isListening 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`text-xs font-semibold ${
                    isListening ? 'text-blue-600' : 'text-gray-400'
                  }`}>音声ストリーム</div>
                  <div className={`text-xs ${
                    isListening ? 'text-blue-500' : 'text-gray-400'
                  }`}>{isListening ? 'アクティブ' : '待機中'}</div>
                </div>
                <div className={`border rounded-lg p-2 text-center transition-all duration-300 ${
                  isListening 
                    ? (isWarning 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-purple-50 border-purple-200')
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`text-xs font-semibold ${
                    isListening 
                      ? (isWarning ? 'text-red-600' : 'text-purple-600')
                      : 'text-gray-400'
                  }`}>
                    コンプライアンス
                  </div>
                  <div className={`text-xs ${
                    isListening 
                      ? (isWarning ? 'text-red-500' : 'text-purple-500')
                      : 'text-gray-400'
                  }`}>
                    {isListening ? (isWarning ? '違反検知' : 'クリア') : '無効'}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 右側：文字起こしパネル */}
        <Card className="w-1/2 bg-white/80 border-slate-200/50 backdrop-blur-sm shadow-xl shadow-blue-100/20">
          <CardContent className="p-6 h-full flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center mb-4 pb-3 border-b border-slate-200">
              <FileText className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">リアルタイム文字起こし</h3>
              <div className="ml-auto">
                <div className={`w-2 h-2 rounded-full ${
                  isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
              </div>
            </div>
            
            {/* 文字起こし内容 */}
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-3">
                {transcript.map((text, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg transition-all duration-300 ${
                      index === transcript.length - 1 && isListening
                        ? 'bg-blue-50 border border-blue-200 shadow-sm'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {text}
                    </p>
                  </div>
                ))}
                
                {/* 監視中でない場合の案内 */}
                {!isListening && transcript.length <= 3 && (
                  <div className="text-center py-8">
                    <div className="text-slate-400 text-sm">
                      音声監視を開始すると、<br />
                      リアルタイムで文字起こしが表示されます
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* フッター */}
            <div className="flex-shrink-0 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>文字起こし精度: {isListening ? '95%' : '---'}</span>
                <span>総文字数: {transcript.join(' ').length} 文字</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* デモ用ボタン（開発中のみ表示） */}
        {isListening && process.env.NODE_ENV === 'development' && (
          <div className="absolute bottom-6 right-6 space-y-2">
            <Button 
              onClick={simulateWarning}
              variant="outline"
              size="sm"
              className="border-yellow-400 text-yellow-600 hover:bg-yellow-100 bg-white text-xs shadow-md"
            >
              <Zap className="w-3 h-3 mr-1" />
              警告シミュレート
            </Button>
            <Button 
              onClick={addDemoTranscript}
              variant="outline"
              size="sm"
              className="border-blue-400 text-blue-600 hover:bg-blue-100 bg-white text-xs shadow-md"
            >
              <FileText className="w-3 h-3 mr-1" />
              文字起こし追加
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
