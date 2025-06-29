'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  AlertTriangle, 
  Shield, 
  Clock, 
  Users, 
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowLeft
} from 'lucide-react'

// チャット分析レポートの型定義
interface ChatAnalysisReport {
  summary: {
    overall_risk_level: 'SAFE' | 'WARNING' | 'DANGER'
    total_messages: number
    analysis_timestamp: string
    chat_duration_minutes: number
    participants: string[]
  }
  compliance_report: {
    total_violations: number
    violation_rate: number
    legal_risk_level: 'low' | 'medium' | 'high'
    violations: Array<{
      type: string
      count: number
      severity: 'low' | 'medium' | 'high'
      examples: string[]
    }>
    recommended_actions: string[]
  }
  confidential_report: {
    total_leaks: number
    security_risk_level: 'low' | 'medium' | 'high'
    leak_types: Array<{
      type: string
      count: number
      risk_level: 'low' | 'medium' | 'high'
    }>
    mitigation_steps: string[]
  }
  timeline_analysis: {
    risk_trend: 'increasing' | 'decreasing' | 'stable'
    risk_timeline: Array<{
      timestamp: string
      risk_level: 'SAFE' | 'WARNING' | 'DANGER'
      message: string
      user: string
    }>
    participant_stats: Array<{
      user: string
      message_count: number
      risk_score: number
      violations: number
    }>
  }
  detailed_findings: Array<{
    finding_id: number
    type: 'compliance_violation' | 'confidential_leak'
    severity: 'low' | 'medium' | 'high'
    description: string
    message: string
    user: string
    timestamp: string
    recommendation: string
  }>
  processing_time_ms: number
}

interface ChatReportProps {
  onBack: () => void
  chatMessages: Array<{
    user: string
    content: string
    timestamp: string
  }>
}

export default function ChatAnalysisReport({ onBack, chatMessages }: ChatReportProps) {
  const [report, setReport] = useState<ChatAnalysisReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // レポート生成
  const generateReport = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/analyze-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages.map(msg => ({
            user: msg.user,
            content: msg.content,
            timestamp: msg.timestamp
          })),
          chat_id: 'demo_chat',
          user_id: 'demo_user'
        })
      })

      if (!response.ok) {
        throw new Error('レポート生成に失敗しました')
      }

      const reportData = await response.json()
      setReport(reportData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  // リスクレベルの色を取得
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'DANGER':
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'WARNING':
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'SAFE':
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // トレンドアイコンを取得
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-red-500" />
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-green-500" />
      case 'stable':
        return <Minus className="w-4 h-4 text-gray-500" />
      default:
        return <Minus className="w-4 h-4 text-gray-500" />
    }
  }

  if (!report) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 flex flex-col">
        <div className="max-w-5xl mx-auto w-full">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={onBack}
                className="text-gray-600 hover:text-gray-800 hover:bg-white/50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">チャット分析レポート</h1>
                <p className="text-gray-600 mt-1">AIによるコンプライアンス・機密情報漏洩の包括分析</p>
              </div>
            </div>
          </div>

          {/* メインコンテンツ - 中央配置と縦方向のスペース配分 */}
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-2xl">
              {/* 分析対象の情報カード */}
              <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white/90 backdrop-blur-sm shadow-md border-0">
                  <CardContent className="p-4 text-center">
                    <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <div className="text-lg font-semibold">{new Set(chatMessages.map(msg => msg.user)).size}</div>
                    <div className="text-sm text-gray-600">参加者</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/90 backdrop-blur-sm shadow-md border-0">
                  <CardContent className="p-4 text-center">
                    <FileText className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <div className="text-lg font-semibold">{chatMessages.length}</div>
                    <div className="text-sm text-gray-600">メッセージ</div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/90 backdrop-blur-sm shadow-md border-0">
                  <CardContent className="p-4 text-center">
                    <Clock className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <div className="text-lg font-semibold">~30秒</div>
                    <div className="text-sm text-gray-600">予想時間</div>
                  </CardContent>
                </Card>
              </div>

              {/* メインレポート生成カード */}
              <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0">
                <CardContent className="p-12 text-center">
                  <div className="mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">包括分析レポート生成</h2>
                    <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto">
                      AIマルチエージェントがチャット履歴を詳細に分析し、コンプライアンス違反と機密情報漏洩リスクを評価します
                    </p>
                  </div>
                  
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-6 text-left">
                      <div className="flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={generateReport}
                    disabled={isLoading || chatMessages.length === 0}
                    size="lg"
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-12 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:hover:shadow-lg"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-3"></div>
                        AI分析実行中...
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5 mr-3" />
                        分析レポート生成
                      </>
                    )}
                  </Button>

                  {chatMessages.length === 0 ? (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-500 text-sm">
                        分析するチャットメッセージがありません
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 text-sm text-gray-500 space-y-2">
                      <p>✓ リアルタイムコンプライアンス検証</p>
                      <p>✓ 機密情報漏洩リスク評価</p>
                      <p>✓ 時系列リスク分析</p>
                      <p>✓ 改善提案の自動生成</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4 md:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-gray-600 hover:text-gray-800 hover:bg-white/50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              戻る
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">分析レポート</h1>
              <p className="text-gray-600 mt-1 text-sm md:text-base">
                生成時刻: {new Date(report.summary.analysis_timestamp).toLocaleString('ja-JP')}
              </p>
            </div>
          </div>
          <Badge className={`text-sm md:text-lg px-3 md:px-4 py-2 font-medium ${getRiskColor(report.summary.overall_risk_level)}`}>
            総合リスク: {report.summary.overall_risk_level}
          </Badge>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-4 md:p-6 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">{report.summary.participants.length}</div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">参加者</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-4 md:p-6 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
                <FileText className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">{report.summary.total_messages}</div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">メッセージ数</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-4 md:p-6 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
                <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">{report.compliance_report.total_violations}</div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">コンプライアンス違反</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0 hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-4 md:p-6 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">{report.confidential_report.total_leaks}</div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">機密情報漏洩</div>
            </CardContent>
          </Card>
        </div>

        {/* メインコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* コンプライアンス分析 */}
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                コンプライアンス分析
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="font-medium">法的リスクレベル</span>
                <Badge className={`px-3 py-1 font-medium ${getRiskColor(report.compliance_report.legal_risk_level)}`}>
                  {report.compliance_report.legal_risk_level.toUpperCase()}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="font-medium">違反率</span>
                <span className="text-xl font-bold text-gray-900">
                  {(report.compliance_report.violation_rate * 100).toFixed(1)}%
                </span>
              </div>

              {report.compliance_report.violations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 text-base">検出された違反</h4>
                  <div className="space-y-3">
                    {report.compliance_report.violations.map((violation, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{violation.type}</span>
                          <div className="text-xs text-gray-500 mt-1">
                            {violation.examples.length > 0 && `例: ${violation.examples[0]}`}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge className={`text-xs ${getRiskColor(violation.severity)}`}>
                            {violation.severity}
                          </Badge>
                          <span className="text-lg font-bold text-gray-900">{violation.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.compliance_report.recommended_actions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 text-base">推奨対応</h4>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <ul className="text-sm space-y-2">
                      {report.compliance_report.recommended_actions.map((action, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-blue-500 mr-3 mt-0.5">•</span>
                          <span className="text-gray-700">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 機密情報分析 */}
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                  <Shield className="w-4 h-4 text-orange-600" />
                </div>
                機密情報分析
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="font-medium">セキュリティリスクレベル</span>
                <Badge className={`px-3 py-1 font-medium ${getRiskColor(report.confidential_report.security_risk_level)}`}>
                  {report.confidential_report.security_risk_level.toUpperCase()}
                </Badge>
              </div>

              {report.confidential_report.leak_types.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 text-base">検出された情報種別</h4>
                  <div className="space-y-3">
                    {report.confidential_report.leak_types.map((leak, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                        <span className="text-sm font-medium text-gray-900">{leak.type}</span>
                        <div className="flex items-center space-x-3">
                          <Badge className={`text-xs ${getRiskColor(leak.risk_level)}`}>
                            {leak.risk_level}
                          </Badge>
                          <span className="text-lg font-bold text-gray-900">{leak.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.confidential_report.mitigation_steps.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 text-base">対策推奨</h4>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                    <ul className="text-sm space-y-2">
                      {report.confidential_report.mitigation_steps.map((step, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-orange-500 mr-3 mt-0.5">•</span>
                          <span className="text-gray-700">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 時系列分析 */}
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                時系列分析
              </div>
              <div className="flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-lg">
                {getTrendIcon(report.timeline_analysis.risk_trend)}
                <span className="text-sm font-medium text-gray-700">
                  リスク推移: {report.timeline_analysis.risk_trend === 'increasing' ? '上昇' : 
                              report.timeline_analysis.risk_trend === 'decreasing' ? '下降' : '安定'}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 参加者統計 */}
            {report.timeline_analysis.participant_stats.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 text-base mb-4">参加者別統計</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {report.timeline_analysis.participant_stats.map((stat, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                      <div className="font-semibold text-gray-900 mb-3 text-center">{stat.user}</div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">メッセージ</span>
                          <span className="font-semibold text-gray-900">{stat.message_count}件</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">リスクスコア</span>
                          <span className={`font-semibold ${stat.risk_score > 0.7 ? 'text-red-600' : stat.risk_score > 0.3 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {(stat.risk_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">違反件数</span>
                          <span className={`font-semibold ${stat.violations > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {stat.violations}件
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* リスクタイムライン */}
            {report.timeline_analysis.risk_timeline.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 text-base mb-4">リスクタイムライン</h4>
                <div className="space-y-3 max-h-80 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                  {report.timeline_analysis.risk_timeline.map((event, index) => (
                    <div key={index} className="flex items-start space-x-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                      <Badge className={`px-2 py-1 text-xs ${getRiskColor(event.risk_level)}`}>
                        {event.risk_level}
                      </Badge>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-gray-900">{event.user}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(event.timestamp).toLocaleString('ja-JP')}
                          </div>
                        </div>
                        <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded italic">
                          &ldquo;{event.message}&rdquo;
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 詳細な所見 */}
        {report.detailed_findings.length > 0 && (
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg border-0">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                詳細な所見
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {report.detailed_findings.map((finding) => (
                  <div key={finding.finding_id} className="border border-gray-100 rounded-lg p-6 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Badge className={`px-3 py-1 font-medium ${getRiskColor(finding.severity)}`}>
                          {finding.severity.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium px-3 py-1 bg-gray-100 rounded-full text-gray-700">
                          {finding.type === 'compliance_violation' ? 'コンプライアンス違反' : '機密情報漏洩'}
                        </span>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <div className="font-medium">{finding.user}</div>
                        <div>{new Date(finding.timestamp).toLocaleString('ja-JP')}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">問題の詳細</h5>
                        <p className="text-gray-700">{finding.description}</p>
                      </div>
                      
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">対象発言</h5>
                        <div className="bg-gray-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                          <p className="text-gray-800 italic">&ldquo;{finding.message}&rdquo;</p>
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">推奨対応</h5>
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                          <p className="text-blue-800">{finding.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* フッター */}
        <div className="text-center text-sm text-gray-500 py-6">
          <div className="flex items-center justify-center space-x-4">
            <span>分析処理時間: {report.processing_time_ms.toFixed(1)}ms</span>
            <span>•</span>
            <span>AI分析エンジン: SafeComm v1.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
