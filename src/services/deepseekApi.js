/**
 * DeepSeek API 服务
 * 请根据 DeepSeek 官方文档配置您的 API 密钥和端点
 */

// 配置项 - 请根据实际情况修改
const DEEPSEEK_CONFIG = {
  // API 端点 - 根据 DeepSeek 官方文档：https://api-docs.deepseek.com/zh-cn/
  // 可以使用 https://api.deepseek.com/chat/completions 或 https://api.deepseek.com/v1/chat/completions
  apiUrl: 'https://api.deepseek.com/chat/completions',
  // API 密钥 - 请替换为您的实际 API 密钥
  apiKey: 'sk-dfbba831df1c40849ca1037506d59921',
  // 模型名称
  model: 'deepseek-reasoner',
  // 流式输出
  stream: true
}

/**
 * 调用 DeepSeek API 进行流式对话
 * @param {Array} messages - 消息历史，格式: [{role: 'user'|'assistant', content: '...'}, ...]
 * @param {Function} onChunk - 接收到数据块时的回调函数 (chunk: {content?: string, reasoning?: string}) => void
 * @param {Function} onComplete - 完成时的回调函数 () => void
 * @param {Function} onError - 错误时的回调函数 (error: Error) => void
 */
export async function chatWithDeepSeek(messages, onChunk, onComplete, onError) {
  try {
    // 检查配置
    if (!DEEPSEEK_CONFIG.apiKey) {
      throw new Error('请先配置 DeepSeek API 密钥')
    }

    // 构建请求体
    const requestBody = {
      model: DEEPSEEK_CONFIG.model,
      messages: messages,
      stream: DEEPSEEK_CONFIG.stream,
      temperature: 0.7,
      max_tokens: 2000
    }

    // 发送请求
    const response = await fetch(DEEPSEEK_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_CONFIG.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    // 处理流式响应
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        break
      }

      // 解码数据
      buffer += decoder.decode(value, { stream: true })
      
      // 处理可能包含多个 SSE 消息的缓冲区
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留最后一个不完整的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6) // 移除 'data: ' 前缀
          
          if (data === '[DONE]') {
            onComplete()
            return
          }

          try {
            const json = JSON.parse(data)
            const delta = json.choices?.[0]?.delta || {}
            
            // 提取 content 和 reasoning_content
            const content = delta.content || ''
            const reasoning = delta.reasoning_content || ''
            
            // 如果有内容，调用回调函数
            if ((content || reasoning) && onChunk) {
              onChunk({
                content: content,
                reasoning: reasoning
              })
            }

            // 检查是否完成
            if (json.choices?.[0]?.finish_reason) {
              onComplete()
              return
            }
          } catch (e) {
            // 忽略 JSON 解析错误（可能是空数据）
            console.warn('解析 SSE 数据失败:', e, data)
          }
        }
      }
    }

    // 处理剩余的缓冲区
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer)
        const delta = json.choices?.[0]?.delta || {}
        const content = delta.content || ''
        const reasoning = delta.reasoning_content || ''
        if ((content || reasoning) && onChunk) {
          onChunk({
            content: content,
            reasoning: reasoning
          })
        }
      } catch (e) {
        // 忽略解析错误
      }
    }

    onComplete()
  } catch (error) {
    console.error('DeepSeek API 调用错误:', error)
    if (onError) {
      onError(error)
    } else {
      throw error
    }
  }
}

/**
 * 更新 API 配置
 * @param {Object} config - 配置对象
 */
export function updateDeepSeekConfig(config) {
  Object.assign(DEEPSEEK_CONFIG, config)
}

/**
 * 获取当前配置
 * @returns {Object} 配置对象
 */
export function getDeepSeekConfig() {
  return { ...DEEPSEEK_CONFIG }
}

/**
 * 判断当前模型是否支持思考链
 * @returns {boolean}
 */
export function isReasonerModel() {
  return DEEPSEEK_CONFIG.model === 'deepseek-reasoner'
}

