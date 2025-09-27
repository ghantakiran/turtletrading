'use client'

import { SocialMediaFeed } from '../page'

interface SocialMediaFeedProps {
  socialMedia: SocialMediaFeed[]
  selectedSymbol: string | null
  onSymbolSelect: (symbol: string | null) => void
  timeRange: '1H' | '4H' | '1D' | '1W' | '1M'
}

export function SocialMediaFeed({ socialMedia, selectedSymbol, onSymbolSelect, timeRange }: SocialMediaFeedProps) {
  const getSentimentColor = (score: number) => {
    if (score >= 50) return 'text-green-600'
    if (score >= 10) return 'text-yellow-600'
    if (score >= -10) return 'text-gray-600'
    if (score >= -50) return 'text-orange-600'
    return 'text-red-600'
  }

  const getSentimentBg = (score: number) => {
    if (score >= 50) return 'bg-green-100'
    if (score >= 10) return 'bg-yellow-100'
    if (score >= -10) return 'bg-gray-100'
    if (score >= -50) return 'bg-orange-100'
    return 'bg-red-100'
  }

  const getPlatformColor = (platform: SocialMediaFeed['platform']) => {
    switch (platform) {
      case 'twitter': return 'bg-blue-100 text-blue-800'
      case 'reddit': return 'bg-orange-100 text-orange-800'
      case 'discord': return 'bg-indigo-100 text-indigo-800'
      case 'stocktwits': return 'bg-green-100 text-green-800'
    }
  }

  const getPlatformIcon = (platform: SocialMediaFeed['platform']) => {
    switch (platform) {
      case 'twitter':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
          </svg>
        )
      case 'reddit':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
          </svg>
        )
      case 'discord':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.197.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        )
      case 'stocktwits':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        )
    }
  }

  const getInfluenceLevel = (influence: number) => {
    if (influence >= 80) return { label: 'High Influence', color: 'text-red-600', bg: 'bg-red-100' }
    if (influence >= 60) return { label: 'Medium Influence', color: 'text-orange-600', bg: 'bg-orange-100' }
    if (influence >= 40) return { label: 'Some Influence', color: 'text-yellow-600', bg: 'bg-yellow-100' }
    return { label: 'Low Influence', color: 'text-gray-600', bg: 'bg-gray-100' }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d`
    }
  }

  const formatEngagement = (engagement: SocialMediaFeed['engagement']) => {
    const total = engagement.likes + engagement.shares + engagement.comments
    if (total >= 1000) return `${(total / 1000).toFixed(1)}k`
    return total.toString()
  }

  const filteredSocialMedia = selectedSymbol
    ? socialMedia.filter(item => item.symbols.includes(selectedSymbol))
    : socialMedia

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Social Media Feed</h2>
            <p className="text-sm text-gray-500 mt-1">
              {selectedSymbol ? `Posts about ${selectedSymbol}` : 'All posts'} • {timeRange} •
              {filteredSocialMedia.length} posts
            </p>
          </div>
          {selectedSymbol && (
            <button
              onClick={() => onSymbolSelect(null)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Show all posts
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {filteredSocialMedia.map((post) => {
          const influenceLevel = getInfluenceLevel(post.influence)
          return (
            <article key={post.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start space-x-4">
                {/* Sentiment indicator */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${getSentimentBg(post.sentimentScore)} flex items-center justify-center`}>
                  <div className="text-center">
                    <div className={`text-sm font-bold ${getSentimentColor(post.sentimentScore)}`}>
                      {post.sentimentScore > 0 ? '+' : ''}{post.sentimentScore}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className={`flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-full ${getPlatformColor(post.platform)}`}>
                        {getPlatformIcon(post.platform)}
                        <span>{post.platform}</span>
                      </span>
                      <span className="text-sm font-medium text-gray-900">@{post.author}</span>
                      <span className="text-sm text-gray-500">{formatTimeAgo(post.timestamp)}</span>
                    </div>
                    <div className={`px-2 py-1 text-xs font-medium rounded-full ${influenceLevel.bg} ${influenceLevel.color}`}>
                      {influenceLevel.label}
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-gray-900 leading-relaxed">
                      {post.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Engagement metrics */}
                      <div className="flex items-center space-x-3 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          <span>{post.engagement.likes.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>{post.engagement.comments.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                          </svg>
                          <span>{post.engagement.shares.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Total engagement */}
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">{formatEngagement(post.engagement)}</span> total engagement
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Related symbols */}
                      <div className="flex items-center space-x-1">
                        {post.symbols.map((symbol) => (
                          <button
                            key={symbol}
                            onClick={() => onSymbolSelect(symbol)}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                              selectedSymbol === symbol
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            ${symbol}
                          </button>
                        ))}
                      </div>

                      {/* Sentiment label */}
                      <div className="text-right">
                        <div className={`text-sm font-medium ${getSentimentColor(post.sentimentScore)}`}>
                          {post.sentimentScore >= 50 ? 'Very Bullish' :
                           post.sentimentScore >= 10 ? 'Bullish' :
                           post.sentimentScore >= -10 ? 'Neutral' :
                           post.sentimentScore >= -50 ? 'Bearish' : 'Very Bearish'}
                        </div>
                        <div className="text-xs text-gray-500">Influence: {post.influence}/100</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {filteredSocialMedia.length === 0 && (
        <div className="p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No social media posts found</h3>
          <p className="text-gray-500 mb-4">
            {selectedSymbol
              ? `No social media posts found for ${selectedSymbol} in the selected time range.`
              : 'No social media posts available for the selected time range.'
            }
          </p>
          {selectedSymbol && (
            <button
              onClick={() => onSymbolSelect(null)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Show all posts
            </button>
          )}
        </div>
      )}

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div>
            Showing {filteredSocialMedia.length} of {socialMedia.length} posts
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              {getPlatformIcon('twitter')}
              <span>Twitter</span>
            </div>
            <div className="flex items-center space-x-1">
              {getPlatformIcon('reddit')}
              <span>Reddit</span>
            </div>
            <div className="flex items-center space-x-1">
              {getPlatformIcon('stocktwits')}
              <span>StockTwits</span>
            </div>
            <div className="flex items-center space-x-1">
              {getPlatformIcon('discord')}
              <span>Discord</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}