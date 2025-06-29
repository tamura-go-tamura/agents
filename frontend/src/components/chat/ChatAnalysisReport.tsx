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
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={onBack}
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">チャット分析レポート</h1>
                <p className="text-gray-600 mt-1">コンプライアンス・機密情報漏洩の包括分析</p>
              </div>
            </div>
          </div>

          {/* レポート生成カード */}
          <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
            <CardContent className="p-8 text-center">
              <FileText className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-4">チャット分析レポートを生成</h2>
              <p className="text-gray-600 mb-6">
                {chatMessages.length}件のメッセージを分析して、コンプライアンス違反と機密情報漏洩リスクを評価します
              </p>
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                  {error}
                </div>
              )}

              <Button
                onClick={generateReport}
                disabled={isLoading || chatMessages.length === 0}
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white px-8 py-3"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    分析中...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    レポート生成開始
                  </>
                )}
              </Button>

              {chatMessages.length === 0 && (
                <p className="text-gray-500 text-sm mt-4">
                  分析するチャットメッセージがありません
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              戻る
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">分析レポート</h1>
              <p className="text-gray-600 mt-1">
                生成時刻: {new Date(report.summary.analysis_timestamp).toLocaleString('ja-JP')}
              </p>
            </div>
          </div>
          <Badge className={`text-lg px-4 py-2 ${getRiskColor(report.summary.overall_risk_level)}`}>
            総合リスク: {report.summary.overall_risk_level}
          </Badge>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{report.summary.participants.length}</div>
              <div className="text-sm text-gray-600">参加者</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <FileText className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{report.summary.total_messages}</div>
              <div className="text-sm text-gray-600">メッセージ数</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{report.compliance_report.total_violations}</div>
              <div className="text-sm text-gray-600">違反検出</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <Shield className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{report.confidential_report.total_leaks}</div>
              <div className="text-sm text-gray-600">機密情報漏洩</div>
            </CardContent>
          </Card>
        </div>

        {/* メインコンテンツ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* コンプライアンス分析 */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                コンプライアンス分析
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span>法的リスクレベル</span>
                <Badge className={getRiskColor(report.compliance_report.legal_risk_level)}>
                  {report.compliance_report.legal_risk_level}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span>違反率</span>
                <span className="font-semibold">
                  {(report.compliance_report.violation_rate * 100).toFixed(1)}%
                </span>
              </div>

              {report.compliance_report.violations.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">検出された違反</h4>
                  <div className="space-y-2">
                    {report.compliance_report.violations.map((violation, index) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                        <span className="text-sm">{violation.type}</span>
                        <div className="flex items-center space-x-2">
                          <Badge className={getRiskColor(violation.severity)}>
                            {violation.severity}
                          </Badge>
                          <span className="text-sm font-semibold">{violation.count}件</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.compliance_report.recommended_actions.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">推奨対応</h4>
                  <ul className="text-sm space-y-1">
                    {report.compliance_report.recommended_actions.map((action, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 機密情報分析 */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2 text-orange-500" />
                機密情報分析
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span>セキュリティリスク</span>
                <Badge className={getRiskColor(report.confidential_report.security_risk_level)}>
                  {report.confidential_report.security_risk_level}
                </Badge>
              </div>

              {report.confidential_report.leak_types.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">検出された情報種別</h4>
                  <div className="space-y-2">
                    {report.confidential_report.leak_types.map((leak, index) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                        <span className="text-sm">{leak.type}</span>
                        <div className="flex items-center space-x-2">
                          <Badge className={getRiskColor(leak.risk_level)}>
                            {leak.risk_level}
                          </Badge>
                          <span className="text-sm font-semibold">{leak.count}件</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.confidential_report.mitigation_steps.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">対策推奨</h4>
                  <ul className="text-sm space-y-1">
                    {report.confidential_report.mitigation_steps.map((step, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-orange-500 mr-2">•</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 時系列分析 */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-blue-500" />
              時系列分析
              <div className="ml-4 flex items-center space-x-2">
                {getTrendIcon(report.timeline_analysis.risk_trend)}
                <span className="text-sm text-gray-600">
                  リスク推移: {report.timeline_analysis.risk_trend}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 参加者統計 */}
            {report.timeline_analysis.participant_stats.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">参加者別統計</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {report.timeline_analysis.participant_stats.map((stat, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded">
                      <div className="font-semibold">{stat.user}</div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>メッセージ: {stat.message_count}件</div>
                        <div>リスクスコア: {(stat.risk_score * 100).toFixed(1)}%</div>
                        <div>違反: {stat.violations}件</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* リスクタイムライン */}
            {report.timeline_analysis.risk_timeline.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">リスクタイムライン</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {report.timeline_analysis.risk_timeline.map((event, index) => (
                    <div key={index} className="flex items-start space-x-3 bg-gray-50 p-3 rounded">
                      <Badge className={getRiskColor(event.risk_level)}>
                        {event.risk_level}
                      </Badge>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{event.user}</div>
                        <div className="text-sm text-gray-600 mb-1">
                          {new Date(event.timestamp).toLocaleString('ja-JP')}
                        </div>
                        <div className="text-sm">{event.message}</div>
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
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>詳細な所見</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {report.detailed_findings.map((finding) => (
                  <div key={finding.finding_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge className={getRiskColor(finding.severity)}>
                          {finding.severity}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {finding.type === 'compliance_violation' ? 'コンプライアンス違反' : '機密情報漏洩'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {finding.user} - {new Date(finding.timestamp).toLocaleString('ja-JP')}
                      </span>
                    </div>
                    <div className="text-sm mb-2">
                      <strong>問題:</strong> {finding.description}
                    </div>
                    <div className="text-sm mb-2 bg-gray-50 p-2 rounded">
                      <strong>発言:</strong> &ldquo;{finding.message}&rdquo;
                    </div>
                    <div className="text-sm text-blue-600">
                      <strong>推奨対応:</strong> {finding.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* フッター */}
        <div className="text-center text-sm text-gray-500 py-4">
          分析処理時間: {report.processing_time_ms.toFixed(1)}ms
        </div>
      </div>
    </div>
  )
}
