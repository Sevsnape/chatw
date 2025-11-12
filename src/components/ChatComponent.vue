<template>
  <div class="chat-container">
    <div class="chat-header">
      <h2>DeepSeek 聊天助手</h2>
    </div>
    
    <div class="chat-messages" ref="messagesContainer">
      <div
        v-for="(message, index) in displayMessages"
        :key="index"
        :class="['message', message.role]"
      >
        <div class="message-avatar">
          <span v-if="message.role === 'user'">👤</span>
          <span v-else>🤖</span>
        </div>
          <div class="message-content">
          <!-- 思考链部分 -->
          <div v-if="message.reasoning && (showReasoning || hasReasoningSupport)" class="reasoning-section">
            <div class="reasoning-header">
              <span class="reasoning-icon">💭</span>
              <span class="reasoning-title">思考过程</span>
            </div>
            <div class="reasoning-content" v-html="formatMarkdown(message.reasoning, true)"></div>
          </div>
          
          <!-- 消息内容 -->
          <div class="message-text" v-html="formatMarkdown(message.content, false, index)" ref="messageText" @click="handleMessageClick($event)"></div>
          
          <!-- 流式输出指示器 -->
          <div v-if="message.role === 'assistant' && message.streaming" class="streaming-indicator">
            <span class="cursor">▋</span>
          </div>
          
          <!-- 消息操作按钮 -->
          <div class="message-actions" v-if="!message.streaming">
            <!-- 用户消息操作 -->
            <template v-if="message.role === 'user'">
              <button @click="copyMessage(message.content)" class="action-btn" title="复制">
                📋 复制
              </button>
            </template>
            <!-- 助手消息操作 -->
            <template v-else>
              <button @click="copyFullMessage(message)" class="action-btn" title="复制完整内容">
                📋 复制
              </button>
              <button @click="regenerateMessage(index)" class="action-btn" title="重新生成">
                🔄 重新生成
              </button>
            </template>
          </div>
          
          <!-- 插槽区域 -->
          <div v-if="message.role === 'user'" class="message-slots">
            <slot name="image-slot" :message="message"></slot>
            <slot name="link-slot" :message="message"></slot>
          </div>
        </div>
      </div>
      
      <!-- <div v-if="loading" class="message assistant">
        <div class="message-avatar">
          <span>🤖</span>
        </div>
        <div class="message-content">
          <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div> -->
    </div>
    
    <div class="chat-input-container">
      <!-- 附加按钮插槽 -->
      <div class="action-buttons" v-if="$slots['action-buttons']">
        <slot name="action-buttons"></slot>
      </div>
      
      <div class="input-wrapper">
        <textarea
          v-model="inputMessage"
          @keydown.enter.exact.prevent="handleEnter"
          @keydown.shift.enter.exact="handleShiftEnter"
          placeholder="输入您的问题..."
          rows="1"
          ref="textarea"
          :disabled="loading"
          class="chat-input"
          style="height:130px"
        ></textarea>
        <button
          @click="sendMessage"
          :disabled="!inputMessage.trim() || loading"
          class="send-button"
        >
          <span v-if="!loading">发送</span>
          <span v-else>发送中...</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { chatWithDeepSeek, isReasonerModel } from '../services/deepseekApi'
import { marked } from 'marked'
import mermaid from 'mermaid'

export default {
  name: 'ChatComponent',
  props: {
    messages: {
      type: Array,
      default: () => []
    },
    showReasoning: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      inputMessage: '',
      loading: false,
      currentStreamingMessage: null,
      localMessages: [],
      mermaidViewModes: {} // 存储每个 mermaid 块的视图模式：'code' 或 'chart'
    }
  },
  computed: {
    displayMessages() {
      // 过滤掉 system 消息，只显示 user 和 assistant
      return this.localMessages.filter(msg => msg.role !== 'system')
    },
    hasReasoningSupport() {
      return isReasonerModel()
    }
  },
  watch: {
    messages: {
      immediate: true,
      handler(newMessages) {
        // 无论消息是否为空，都要更新 localMessages
        if (newMessages) {
          this.localMessages = JSON.parse(JSON.stringify(newMessages))
          // 消息更新后，先滚动到底部（立即执行）
          this.$nextTick(() => {
            this.scrollToBottom()
          })
          
          // 如果有消息，渲染所有 mermaid 图表
          if (newMessages.length > 0) {
            this.$nextTick(() => {
              this.renderMermaidInMessage()
              // renderMermaidInMessage 内部会在渲染完成后再次滚动到底部
            })
          }
        } else {
          this.localMessages = []
          this.$nextTick(() => {
            this.scrollToBottom()
          })
        }
      }
    }
  },
  mounted() {
    // // 如果没有消息，添加欢迎消息
    // if (this.localMessages.length === 0) {
    //   this.localMessages.push({
    //     role: 'assistant',
    //     content: '您好！我是 DeepSeek 助手，有什么可以帮助您的吗？',
    //     streaming: false
    //   })
    // }
    
    // 配置 marked
    marked.setOptions({
      breaks: true,
      gfm: true
    })
    
    // 初始化 mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose'
    })
    
    // 如果已有消息，渲染 mermaid 图表
    if (this.localMessages && this.localMessages.length > 0) {
      this.$nextTick(() => {
        this.renderMermaidInMessage()
      })
    }
    
    // 注册全局代码块操作函数
    const self = this
    window.toggleMermaidView = (mermaidId) => {
      const viewModeKey = mermaidId
      const currentMode = self.mermaidViewModes[viewModeKey] || 'chart'
      const newMode = currentMode === 'code' ? 'chart' : 'code'
      
      // 更新视图模式（使用 Vue.set 确保响应式）
      if (!self.mermaidViewModes[viewModeKey]) {
        self.$set(self.mermaidViewModes, viewModeKey, newMode)
      } else {
        self.mermaidViewModes[viewModeKey] = newMode
      }
      
      // 强制更新视图（不触发重新渲染）
      self.$nextTick(() => {
        // 使用更精确的选择器，确保只更新当前 mermaid 块
        // 通过 data-mermaid-id 属性来定位，避免影响其他图表
        const wrapper = document.querySelector(`[data-mermaid-id="${mermaidId}"]`)
        if (!wrapper) {
          console.warn('未找到 mermaid 块包装器:', mermaidId)
          return
        }
        
        // 在当前包装器内查找元素，确保只更新当前块
        const codeView = wrapper.querySelector(`#mermaid-code-${mermaidId}`)
        const chartView = wrapper.querySelector(`#mermaid-chart-${mermaidId}`)
        const toggleBtn = wrapper.querySelector(`[onclick="window.toggleMermaidView('${mermaidId}')"]`)
        const mermaidElement = wrapper.querySelector(`#${mermaidId}`)
        
        if (codeView && chartView && toggleBtn) {
          // 更新视图显示：根据 newMode 显示/隐藏
          // CSS 规则：data-view-mode="code" 显示代码视图，data-view-mode="chart" 显示图表视图
          codeView.setAttribute('data-view-mode', newMode)
          chartView.setAttribute('data-view-mode', newMode)
        
          // 更新按钮文本：按钮显示的是"点击后切换到"的模式
          const toggleIcon = toggleBtn.querySelector('.toggle-icon')
          const toggleText = toggleBtn.querySelector('.toggle-text')
          if (toggleIcon && toggleText) {
            // newMode 是切换后的模式，按钮应该显示"切换到另一个模式"
            if (newMode === 'code') {
              // 当前切换到代码模式，按钮应该显示"显示图表"（下次点击会切换回图表）
              toggleIcon.textContent = '📊'
              toggleText.textContent = '显示图表'
            } else {
              // 当前切换到图表模式，按钮应该显示"显示代码"（下次点击会切换到代码）
              toggleIcon.textContent = '📝'
              toggleText.textContent = '显示代码'
            }
          }
          
          // 如果切换到图表模式，需要渲染 mermaid
          if (newMode === 'chart' && mermaidElement) {
            // 清除之前的渲染标记，允许重新渲染
            mermaidElement.removeAttribute('data-rendered')
            mermaidElement.removeAttribute('data-rendering')
            
            // 优先从 data-mermaid-code 属性获取代码
            let originalCode = mermaidElement.getAttribute('data-mermaid-code')
            if (originalCode) {
              originalCode = originalCode.replace(/&quot;/g, '"')
            } else {
              // 如果 data-mermaid-code 不存在，从代码视图中获取
              const codeElement = codeView.querySelector('code')
              if (codeElement) {
                // 获取代码文本（需要解码 HTML 实体）
                originalCode = codeElement.textContent || codeElement.innerText
                // 如果 textContent 为空，尝试从 innerHTML 中提取
                if (!originalCode || !originalCode.trim()) {
                  const tempDiv = document.createElement('div')
                  tempDiv.innerHTML = codeElement.innerHTML
                  originalCode = tempDiv.textContent || tempDiv.innerText || ''
                }
              }
            }
            
            if (originalCode && originalCode.trim()) {
              // 恢复原始代码到 mermaid 元素和 data 属性
              const cleanCode = originalCode.trim()
              mermaidElement.textContent = cleanCode
              mermaidElement.setAttribute('data-mermaid-code', cleanCode.replace(/"/g, '&quot;'))
            }
          }
          
          // 切换视图后，重新渲染所有处于图表视图的图表，确保所有图表都正确显示
          setTimeout(() => {
            self.renderAllMermaidCharts()
          }, 150)
        }
      })
    }
    
    window.copyMermaidCode = (mermaidId) => {
      const wrapper = document.querySelector(`[data-mermaid-id="${mermaidId}"]`)
      if (wrapper) {
        const codeView = wrapper.querySelector(`#mermaid-code-${mermaidId}`)
        if (codeView) {
          const code = codeView.querySelector('code')?.textContent || ''
          self.copyToClipboard(code)
          self.showToast('Mermaid 代码已复制到剪贴板')
        }
      }
    }
    
    window.downloadMermaidChart = (mermaidId) => {
      const wrapper = document.querySelector(`[data-mermaid-id="${mermaidId}"]`)
      if (!wrapper) return
      
      const mermaidElement = wrapper.querySelector(`#${mermaidId}`)
      if (!mermaidElement) return
      
      // 查找 SVG 元素
      const svgElement = mermaidElement.querySelector('svg')
      if (!svgElement) {
        self.showToast('图表尚未渲染，请稍候再试')
        return
      }
      
      try {
        // 克隆 SVG 以保持原始不变
        const clonedSvg = svgElement.cloneNode(true)
        
        // 获取 SVG 的尺寸
        const bbox = svgElement.getBBox()
        const width = bbox.width || svgElement.getAttribute('width') || 800
        const height = bbox.height || svgElement.getAttribute('height') || 600
        
        // 设置 SVG 属性
        clonedSvg.setAttribute('width', width)
        clonedSvg.setAttribute('height', height)
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        
        // 将 SVG 转换为字符串
        const svgString = new XMLSerializer().serializeToString(clonedSvg)
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
        const svgUrl = URL.createObjectURL(svgBlob)
        
        // 创建下载链接
        const downloadLink = document.createElement('a')
        downloadLink.href = svgUrl
        downloadLink.download = `mermaid-chart-${mermaidId}-${Date.now()}.svg`
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(svgUrl)
        
        self.showToast('图表已下载为 SVG')
      } catch (error) {
        console.error('下载图表失败:', error)
        self.showToast('下载失败，请稍候再试')
      }
    }
    
    window.copyCodeBlock = (codeId) => {
      const codeElement = document.getElementById(codeId)
      if (codeElement) {
        // 优先使用 textContent 获取纯文本，如果没有则使用 data-code
        let code = codeElement.textContent || codeElement.innerText
        if (!code && codeElement.getAttribute('data-code')) {
          // 如果 textContent 为空，从 data-code 属性解码
          const encodedCode = codeElement.getAttribute('data-code')
          code = encodedCode
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&#10;/g, '\n')
        }
        self.copyToClipboard(code)
        self.showToast('代码已复制到剪贴板')
      }
    }
    
    window.downloadCodeBlock = (codeId) => {
      const codeElement = document.getElementById(codeId)
      if (codeElement) {
        // 优先使用 textContent 获取纯文本
        let code = codeElement.textContent || codeElement.innerText
        if (!code && codeElement.getAttribute('data-code')) {
          // 如果 textContent 为空，从 data-code 属性解码
          const encodedCode = codeElement.getAttribute('data-code')
          code = encodedCode
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&#10;/g, '\n')
        }
        const blob = new Blob([code], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `code-${Date.now()}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        self.showToast('代码已下载')
      }
    }
  },
  
  beforeDestroy() {
    // 清理全局函数
    delete window.copyCodeBlock
    delete window.downloadCodeBlock
    delete window.toggleMermaidView
    delete window.copyMermaidCode
    delete window.downloadMermaidChart
  },
  
  methods: {
    async renderMermaid(mermaidId) {
      // 使用包装器来查找元素，确保只影响当前图表
      const wrapper = document.querySelector(`[data-mermaid-id="${mermaidId}"]`)
      if (!wrapper) {
        console.warn('Mermaid 包装器不存在:', mermaidId)
        return
      }
      
      const element = wrapper.querySelector(`#${mermaidId}`)
      if (!element) {
        console.warn('Mermaid 元素不存在:', mermaidId)
        return
      }
      
      // 检查是否在图表视图中
      const chartView = wrapper.querySelector(`#mermaid-chart-${mermaidId}`)
      if (chartView) {
        const viewMode = chartView.getAttribute('data-view-mode')
        if (viewMode !== 'chart') {
          // 不在图表模式，不渲染
          return
        }
      }
      
      // 如果正在渲染，跳过
      if (element.hasAttribute('data-rendering')) {
        return
      }
      
      // 如果已经渲染过且有 SVG，跳过
      if (element.hasAttribute('data-rendered')) {
        const hasSvg = element.querySelector('svg') || element.innerHTML.includes('<svg')
        if (hasSvg) {
          return
        }
        // 如果标记为已渲染但没有 SVG，清除标记重新渲染
        element.removeAttribute('data-rendered')
      }
      
      try {
        // 获取原始代码，优先从 data-mermaid-code 属性获取
        let code = element.getAttribute('data-mermaid-code')
        if (code) {
          code = code.replace(/&quot;/g, '"')
        } else {
          // 从文本内容获取
          code = element.textContent || element.innerText
        }
        
        // 如果 textContent 为空，尝试从代码视图中获取
        if (!code || !code.trim()) {
          const codeView = wrapper.querySelector(`#mermaid-code-${mermaidId}`)
          if (codeView) {
            const codeElement = codeView.querySelector('code')
            if (codeElement) {
              code = codeElement.textContent || codeElement.innerText || ''
            }
          }
        }
        
        // 如果还是为空，尝试从 innerHTML 中提取文本
        if (!code || !code.trim()) {
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = element.innerHTML
          code = tempDiv.textContent || tempDiv.innerText || ''
        }
        
        if (!code || !code.trim()) {
          console.warn('Mermaid 代码为空:', mermaidId)
          return
        }
        
        // 标记为正在渲染
        element.setAttribute('data-rendering', 'true')
        
        // 保存原始代码
        const originalCode = code.trim()
        
        // 保存代码到 data 属性，以便后续使用
        if (!element.getAttribute('data-mermaid-code')) {
          element.setAttribute('data-mermaid-code', originalCode.replace(/"/g, '&quot;'))
        }
        
        // 清除元素内容，准备渲染
        element.textContent = originalCode
        element.className = 'mermaid'
        
        // 使用 mermaid.run API（这是 Mermaid 10+ 版本的推荐方式）
        if (typeof mermaid.run === 'function') {
          await mermaid.run({
            nodes: [element],
            suppressErrors: false
          })
          
          // 检查是否成功渲染（应该有 SVG）
          const hasSvg = element.querySelector('svg') || element.innerHTML.includes('<svg')
          if (!hasSvg) {
            throw new Error('Mermaid 渲染未生成 SVG')
          }
        } else if (typeof mermaid.render === 'function') {
          // 降级方案：使用 render API
          const result = await mermaid.render(`${mermaidId}-svg`, originalCode)
          const svg = result.svg || result
          if (svg && typeof svg === 'string' && svg.includes('<svg')) {
            element.innerHTML = svg
          } else {
            throw new Error('Mermaid 渲染返回无效的 SVG')
          }
        } else {
          throw new Error('Mermaid API 不可用')
        }
        
        // 标记为已渲染
        element.removeAttribute('data-rendering')
        element.setAttribute('data-rendered', 'true')
      } catch (error) {
        console.error('Mermaid 渲染失败:', error, mermaidId)
        element.removeAttribute('data-rendering')
        let errorMsg = '未知错误'
        if (error) {
          if (typeof error === 'string') {
            errorMsg = error
          } else if (error.message) {
            errorMsg = error.message
          } else if (error.toString && error.toString() !== '[object Object]') {
            errorMsg = error.toString()
          }
        }
        element.innerHTML = `<div class="mermaid-error">图表渲染失败：${errorMsg}</div>`
      }
    },
    
    renderMermaidInMessage() {
      // 在消息渲染后，渲染所有可见的 mermaid 图表
      this.$nextTick(() => {
        // 使用 requestAnimationFrame 确保 DOM 完全渲染
        requestAnimationFrame(() => {
          setTimeout(() => {
            // 查找所有 mermaid 包装器，确保每个图表独立处理
            const wrappers = document.querySelectorAll('.mermaid-block-wrapper')
            wrappers.forEach(wrapper => {
              const mermaidId = wrapper.getAttribute('data-mermaid-id')
              if (!mermaidId) return
              
              // 在当前包装器内查找 mermaid 元素
              const mermaidElement = wrapper.querySelector(`#${mermaidId}`)
              if (!mermaidElement) return
              
              // 检查是否在图表视图中
              const chartView = wrapper.querySelector(`#mermaid-chart-${mermaidId}`)
              if (chartView) {
                const viewMode = chartView.getAttribute('data-view-mode')
                if (viewMode === 'chart') {
                  // 确保元素中有代码（从 data-mermaid-code 属性或文本内容获取）
                  const codeAttr = mermaidElement.getAttribute('data-mermaid-code')
                  if (codeAttr && (!mermaidElement.textContent || !mermaidElement.textContent.trim())) {
                    mermaidElement.textContent = codeAttr.replace(/&quot;/g, '"')
                  }
                  // 只有在图表模式下才渲染
                  this.renderMermaid(mermaidId)
                }
              } else {
                // 如果找不到 chartView，使用默认模式
                const viewMode = this.mermaidViewModes[mermaidId] || 'chart'
                if (viewMode === 'chart') {
                  this.renderMermaid(mermaidId)
                }
              }
            })
            
            // 渲染完成后，滚动到底部（因为图表渲染可能会改变内容高度）
            setTimeout(() => {
              this.scrollToBottom()
            }, 300)
          }, 100) // 延迟确保 DOM 完全更新
        })
      })
    },
    
    renderAllMermaidCharts() {
      // 重新渲染所有处于图表视图的图表，强制清除渲染标记
      const wrappers = document.querySelectorAll('.mermaid-block-wrapper')
      wrappers.forEach(wrapper => {
        const mermaidId = wrapper.getAttribute('data-mermaid-id')
        if (!mermaidId) return
        
        // 在当前包装器内查找 mermaid 元素
        const mermaidElement = wrapper.querySelector(`#${mermaidId}`)
        if (!mermaidElement) return
        
        // 检查是否在图表视图中
        const chartView = wrapper.querySelector(`#mermaid-chart-${mermaidId}`)
        if (chartView) {
          const viewMode = chartView.getAttribute('data-view-mode')
          if (viewMode === 'chart') {
            // 清除渲染标记，强制重新渲染
            mermaidElement.removeAttribute('data-rendered')
            mermaidElement.removeAttribute('data-rendering')
            
            // 确保元素中有代码（从 data-mermaid-code 属性或文本内容获取）
            let code = mermaidElement.getAttribute('data-mermaid-code')
            if (code) {
              code = code.replace(/&quot;/g, '"')
            } else {
              // 如果 data-mermaid-code 不存在，从代码视图中获取
              const codeView = wrapper.querySelector(`#mermaid-code-${mermaidId}`)
              if (codeView) {
                const codeElement = codeView.querySelector('code')
                if (codeElement) {
                  code = codeElement.textContent || codeElement.innerText || ''
                }
              }
            }
            
            // 如果代码存在，确保元素中有代码
            if (code && code.trim()) {
              const cleanCode = code.trim()
              mermaidElement.textContent = cleanCode
              mermaidElement.setAttribute('data-mermaid-code', cleanCode.replace(/"/g, '&quot;'))
            }
            
            // 渲染图表
            this.renderMermaid(mermaidId)
          }
        }
      })
    },
    async sendMessage() {
      if (!this.inputMessage.trim() || this.loading) {
        return
      }

      const userMessage = this.inputMessage.trim()
      this.inputMessage = ''
      
      // 添加用户消息
      const userMsg = {
        role: 'user',
        content: userMessage
      }
      this.localMessages.push(userMsg)
      this.$emit('message-added', userMsg)

      // 添加空的助手消息用于流式输出
      const assistantMessage = {
        role: 'assistant',
        content: '',
        reasoning: '',
        streaming: true
      }
      this.localMessages.push(assistantMessage)
      this.currentStreamingMessage = assistantMessage
      this.loading = true

      this.scrollToBottom()

      try {
        // 准备发送的消息（排除 system 消息和当前流式消息）
        const messagesToSend = this.localMessages
          .filter(msg => msg.role !== 'system' && msg !== assistantMessage)
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }))

        // 调用 DeepSeek API
        await chatWithDeepSeek(
          messagesToSend,
          (chunk) => {
            // 流式接收数据
            if (this.currentStreamingMessage) {
              // 处理思考内容和回答内容
              if (chunk.reasoning) {
                this.currentStreamingMessage.reasoning = (this.currentStreamingMessage.reasoning || '') + chunk.reasoning
              }
              if (chunk.content) {
                this.currentStreamingMessage.content += chunk.content
              }
              this.$forceUpdate()
              this.scrollToBottom()
              // 在流式输出过程中，延迟渲染 Mermaid（避免频繁渲染）
              this.$nextTick(() => {
                // 查找所有 mermaid 包装器，确保每个图表独立处理
                const wrappers = document.querySelectorAll('.mermaid-block-wrapper')
                if (wrappers.length > 0) {
                  // 使用防抖，只在流式输出暂停时渲染
                  clearTimeout(this.mermaidRenderTimer)
                  this.mermaidRenderTimer = setTimeout(() => {
                    wrappers.forEach(wrapper => {
                      const mermaidId = wrapper.getAttribute('data-mermaid-id')
                      if (!mermaidId) return
                      
                      // 在当前包装器内查找 mermaid 元素
                      const mermaidElement = wrapper.querySelector(`#${mermaidId}`)
                      if (!mermaidElement) return
                      
                      // 如果已经渲染过或正在渲染，跳过
                      if (mermaidElement.hasAttribute('data-rendered') || mermaidElement.hasAttribute('data-rendering')) {
                        return
                      }
                      
                      // 确保元素中有代码（从 data-mermaid-code 属性或文本内容获取）
                      const codeAttr = mermaidElement.getAttribute('data-mermaid-code')
                      if (codeAttr && (!mermaidElement.textContent || !mermaidElement.textContent.trim())) {
                        mermaidElement.textContent = codeAttr.replace(/&quot;/g, '"')
                      }
                      
                      // 检查是否在图表视图中
                      const chartView = wrapper.querySelector(`#mermaid-chart-${mermaidId}`)
                      if (chartView) {
                        const viewMode = chartView.getAttribute('data-view-mode')
                        if (viewMode === 'chart') {
                          // 只有在图表模式下才渲染，不提前设置 data-rendered
                          this.renderMermaid(mermaidId)
                        }
                      } else {
                        // 如果找不到 chartView，使用默认模式
                        const viewMode = this.mermaidViewModes[mermaidId] || 'chart'
                        if (viewMode === 'chart') {
                          this.renderMermaid(mermaidId)
                        }
                      }
                    })
                  }, 500) // 500ms 防抖
                }
              })
            }
          },
          () => {
            // 完成回调
            if (this.currentStreamingMessage) {
              this.currentStreamingMessage.streaming = false
              // 如果流式响应中没有直接返回 reasoning，尝试从 content 中提取
              if (!this.currentStreamingMessage.reasoning) {
                this.processReasoning(this.currentStreamingMessage)
              }
              this.$emit('message-complete', this.currentStreamingMessage)
              this.currentStreamingMessage = null
            }
            this.loading = false
            this.scrollToBottom()
            // 消息完成后，渲染所有 Mermaid 图表
            this.$nextTick(() => {
              this.renderMermaidInMessage()
            })
          },
          (error) => {
            // 错误处理
            console.error('API 调用错误:', error)
            let errorMessage = '未知错误'
            if (error) {
              if (typeof error === 'string') {
                errorMessage = error
              } else if (error.message) {
                errorMessage = error.message
              } else if (error.toString && error.toString() !== '[object Object]') {
                errorMessage = error.toString()
              }
            }
            if (this.currentStreamingMessage) {
              this.currentStreamingMessage.content = '抱歉，发生了错误：' + errorMessage
              this.currentStreamingMessage.streaming = false
              this.currentStreamingMessage = null
            }
            this.loading = false
            this.scrollToBottom()
          }
        )
      } catch (error) {
        console.error('发送消息错误:', error)
        let errorMessage = '未知错误'
        if (error) {
          if (typeof error === 'string') {
            errorMessage = error
          } else if (error.message) {
            errorMessage = error.message
          } else if (error.toString && error.toString() !== '[object Object]') {
            errorMessage = error.toString()
          }
        }
        if (this.currentStreamingMessage) {
          this.currentStreamingMessage.content = '抱歉，发生了错误：' + errorMessage
          this.currentStreamingMessage.streaming = false
          this.currentStreamingMessage = null
        }
        this.loading = false
      }
    },
    
    processReasoning(message) {
      if (!this.hasReasoningSupport || !message.content) {
        return
      }
      
      // 提取思考链内容，支持多种格式：
      // 1. <think>...</think>
      // 2. <think>...</think>
      // 3. <think>...</think>
      const thinkRegex = /<think>(.*?)<\/think>/gs
      const thinkRegex2 = /<think>(.*?)<\/think>/gs
      const redactedRegex = /<think>(.*?)<\/redacted_reasoning>/gs
      
      let reasoning = ''
      const thinkMatches = [...message.content.matchAll(thinkRegex)]
      const thinkMatches2 = [...message.content.matchAll(thinkRegex2)]
      const redactedMatches = [...message.content.matchAll(redactedRegex)]
      
      if (thinkMatches.length > 0) {
        reasoning = thinkMatches.map(match => match[1]).join('\n\n')
        message.content = message.content.replace(thinkRegex, '').trim()
      } else if (thinkMatches2.length > 0) {
        reasoning = thinkMatches2.map(match => match[1]).join('\n\n')
        message.content = message.content.replace(thinkRegex2, '').trim()
      } else if (redactedMatches.length > 0) {
        reasoning = redactedMatches.map(match => match[1]).join('\n\n')
        message.content = message.content.replace(redactedRegex, '').trim()
      }
      
      if (reasoning) {
        message.reasoning = reasoning
      }
    },
    
    handleEnter() {
      if (!this.loading) {
        this.sendMessage()
      }
    },
    
    handleShiftEnter() {
      // Shift+Enter 换行，不做处理
    },
    
    scrollToBottom() {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer
        if (container) {
          // 使用平滑滚动，但立即执行
          container.scrollTop = container.scrollHeight
          // 使用 requestAnimationFrame 确保 DOM 完全渲染后再滚动
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight
          })
        }
      })
    },
    
    formatMarkdown(content, isReasoning = false, messageIndex = 0) {
      if (!content) return ''
      
      try {
        // 使用 marked 解析 Markdown
        let html = marked.parse(content)
        // 思考过程中不处理 Mermaid 和代码块操作按钮
        if (!isReasoning) {
          // 处理 Mermaid 代码块（传入消息索引确保唯一性）
          html = this.processMermaidBlocks(html, messageIndex)
          // 为代码块添加操作按钮
          html = this.addCodeBlockActions(html)
        }
        return html
      } catch (e) {
        console.warn('Markdown 解析失败:', e)
        // 如果解析失败，返回转义后的 HTML
        return content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
      }
    },
    
    processMermaidBlocks(html, messageIndex = 0) {
      // 匹配 mermaid 代码块：```mermaid 或 ```mermaid:xxx
      // 注意：marked 会将代码块转换为 <pre><code class="language-mermaid">...</code></pre>
      let blockIndex = 0 // 用于同一消息中多个 mermaid 块的计数
      return html.replace(/<pre><code[^>]*class="language-mermaid"[^>]*>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
        blockIndex++ // 每个匹配到的块递增
        // 清理代码：移除 HTML 实体编码，提取纯文本
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = code
        let cleanCode = tempDiv.textContent || tempDiv.innerText || code
        
        // 移除可能的 CSS 样式块（以 # 开头的样式定义）
        // 只保留 Mermaid 语法代码
        const lines = cleanCode.split('\n')
        const mermaidLines = []
        let inStyleBlock = false
        
        for (const line of lines) {
          const trimmed = line.trim()
          // 检测样式块开始（通常是 #id{ 或 @keyframes）
          if (trimmed.match(/^#[a-zA-Z0-9-]+\s*\{/) || trimmed.startsWith('@keyframes') || trimmed.startsWith('@media')) {
            inStyleBlock = true
            continue
          }
          // 检测样式块结束
          if (inStyleBlock && trimmed === '}') {
            inStyleBlock = false
            continue
          }
          // 如果在样式块中，跳过
          if (inStyleBlock) {
            continue
          }
          // 保留非样式行
          mermaidLines.push(line)
        }
        
        cleanCode = mermaidLines.join('\n').trim()
        
        // 如果清理后没有内容，使用原始代码
        if (!cleanCode) {
          cleanCode = code
        }
        
        // 使用内容哈希 + 消息索引生成唯一的 ID，确保每个消息中的 mermaid 块都有唯一 ID
        let hash = 0
        for (let i = 0; i < cleanCode.length; i++) {
          const char = cleanCode.charCodeAt(i)
          hash = ((hash << 5) - hash) + char
          hash = hash & hash // Convert to 32bit integer
        }
        // 结合消息索引和块索引，确保每个 mermaid 块都有唯一的 ID
        // 格式：mermaid-msg{消息索引}-block{块索引}-{哈希值}
        const mermaidId = `mermaid-msg${messageIndex}-block${blockIndex}-${Math.abs(hash).toString(36)}`
        const viewModeKey = mermaidId
        
        // 获取视图模式，如果不存在则使用默认值（不修改响应式数据）
        const viewMode = this.mermaidViewModes[viewModeKey] || 'chart'
        
        // 转义代码用于显示
        const escapedCode = cleanCode
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        
        return `
          <div class="mermaid-block-wrapper" data-mermaid-id="${mermaidId}">
            <div class="mermaid-block-actions">
              <button class="mermaid-toggle-btn" onclick="window.toggleMermaidView('${mermaidId}')" title="切换视图">
                <span class="toggle-icon">${viewMode === 'chart' ? '📝' : '📊'}</span>
                <span class="toggle-text">${viewMode === 'chart' ? '显示代码' : '显示图表'}</span>
              </button>
              <button class="mermaid-copy-btn" onclick="window.copyMermaidCode('${mermaidId}')" title="复制代码">
                📋 复制
              </button>
              <button class="mermaid-download-btn" onclick="window.downloadMermaidChart('${mermaidId}')" title="下载图表">
                💾 下载
              </button>
            </div>
            <div class="mermaid-code-view" data-view-mode="${viewMode}" id="mermaid-code-${mermaidId}">
              <pre><code>${escapedCode}</code></pre>
            </div>
            <div class="mermaid-chart-view" data-view-mode="${viewMode}" id="mermaid-chart-${mermaidId}">
              <div class="mermaid-content" id="${mermaidId}" data-mermaid-code="${cleanCode.replace(/"/g, '&quot;')}">${cleanCode}</div>
            </div>
          </div>
        `
      })
    },
    
    addCodeBlockActions(html) {
      // 为每个代码块添加操作按钮（排除 mermaid 代码块，因为已经单独处理）
      return html.replace(/<pre><code(?!.*class="language-mermaid")[^>]*>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
        const codeId = 'code-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        // 转义代码内容，用于 data-code 属性
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/\n/g, '&#10;')
        return `
          <div class="code-block-wrapper">
            <div class="code-block-actions">
              <button class="code-action-btn" onclick="window.copyCodeBlock('${codeId}')" title="复制代码">
                📋 复制
              </button>
              <button class="code-action-btn" onclick="window.downloadCodeBlock('${codeId}')" title="下载代码">
                💾 下载
              </button>
            </div>
            <pre><code id="${codeId}" data-code="${escapedCode}">${code}</code></pre>
          </div>
        `
      })
    },
    
    handleMessageClick(event) {
      // 处理代码块按钮点击（通过事件委托）
      if (event.target.classList.contains('code-action-btn')) {
        event.stopPropagation()
      }
    },
    
    copyMessage(content) {
      this.copyToClipboard(content)
      this.showToast('已复制到剪贴板')
    },
    
    copyFullMessage(message) {
      let fullText = message.content
      if (message.reasoning && this.showReasoning) {
        fullText = `思考过程：\n${message.reasoning}\n\n回答：\n${message.content}`
      }
      this.copyToClipboard(fullText)
      this.showToast('已复制完整内容到剪贴板')
    },
    
    async regenerateMessage(index) {
      // 找到对应的用户消息
      const assistantMsg = this.displayMessages[index]
      if (!assistantMsg || assistantMsg.role !== 'assistant') {
        return
      }
      
      // 找到这条助手消息之前的用户消息
      let userMsgIndex = -1
      for (let i = index - 1; i >= 0; i--) {
        if (this.displayMessages[i].role === 'user') {
          userMsgIndex = i
          break
        }
      }
      
      if (userMsgIndex === -1) {
        this.showToast('未找到对应的用户消息')
        return
      }
      
      const userMsg = this.displayMessages[userMsgIndex]
      
      // 找到用户消息在 localMessages 中的位置
      const userMsgLocalIndex = this.localMessages.findIndex(msg => 
        msg.role === 'user' && msg.content === userMsg.content
      )
      
      if (userMsgLocalIndex === -1) {
        this.showToast('未找到对应的用户消息')
        return
      }
      
      // 移除当前的助手消息及其之后的所有消息（避免重复显示）
      const assistantMsgLocalIndex = this.localMessages.findIndex(msg => msg === assistantMsg)
      if (assistantMsgLocalIndex !== -1) {
        // 移除从助手消息开始到数组末尾的所有消息
        this.localMessages.splice(assistantMsgLocalIndex)
      }
      
      // 创建新的助手消息用于流式输出
      const newAssistantMessage = {
        role: 'assistant',
        content: '',
        reasoning: '',
        streaming: true
      }
      this.localMessages.push(newAssistantMessage)
      this.currentStreamingMessage = newAssistantMessage
      this.loading = true
      
      this.scrollToBottom()
      
      // 准备发送的消息（到用户消息为止，包括用户消息）
      const messagesToSend = this.localMessages
        .slice(0, userMsgLocalIndex + 1)
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      
      try {
        await chatWithDeepSeek(
          messagesToSend,
          (chunk) => {
            if (this.currentStreamingMessage) {
              // 处理思考内容和回答内容
              if (chunk.reasoning) {
                this.currentStreamingMessage.reasoning = (this.currentStreamingMessage.reasoning || '') + chunk.reasoning
              }
              if (chunk.content) {
                this.currentStreamingMessage.content += chunk.content
              }
              this.$forceUpdate()
              this.scrollToBottom()
            }
          },
          () => {
            if (this.currentStreamingMessage) {
              this.currentStreamingMessage.streaming = false
              // 如果流式响应中没有直接返回 reasoning，尝试从 content 中提取
              if (!this.currentStreamingMessage.reasoning) {
                this.processReasoning(this.currentStreamingMessage)
              }
              this.$emit('message-complete', this.currentStreamingMessage)
              this.currentStreamingMessage = null
            }
            this.loading = false
            this.scrollToBottom()
          },
          (error) => {
            console.error('API 调用错误:', error)
            if (this.currentStreamingMessage) {
              this.currentStreamingMessage.content = '抱歉，发生了错误：' + (error.message || '未知错误')
              this.currentStreamingMessage.streaming = false
              this.currentStreamingMessage = null
            }
            this.loading = false
            this.scrollToBottom()
          }
        )
      } catch (error) {
        console.error('重新生成消息错误:', error)
        let errorMessage = '未知错误'
        if (error) {
          if (typeof error === 'string') {
            errorMessage = error
          } else if (error.message) {
            errorMessage = error.message
          } else if (error.toString && error.toString() !== '[object Object]') {
            errorMessage = error.toString()
          }
        }
        if (this.currentStreamingMessage) {
          this.currentStreamingMessage.content = '抱歉，发生了错误：' + errorMessage
          this.currentStreamingMessage.streaming = false
          this.currentStreamingMessage = null
        }
        this.loading = false
      }
    },
    
    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text)
      } catch (err) {
        // 降级方案
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
    },
    
    showToast(message) {
      // 简单的提示实现
      const toast = document.createElement('div')
      toast.className = 'toast-message'
      toast.textContent = message
      document.body.appendChild(toast)
      setTimeout(() => {
        toast.classList.add('show')
      }, 10)
      setTimeout(() => {
        toast.classList.remove('show')
        setTimeout(() => {
          document.body.removeChild(toast)
        }, 300)
      }, 2000)
    }
  }
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  flex: 1;
  background: #f5f5f5;
}

.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.chat-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.message {
  display: flex;
  gap: 12px;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.message.user .message-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.message-content {
  max-width: 70%;
  background: white;
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  word-wrap: break-word;
}

.message.user .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

/* 思考链样式 */
.reasoning-section {
  margin-bottom: 12px;
  padding: 12px;
  background: rgba(102, 126, 234, 0.1);
  border-left: 3px solid #667eea;
  border-radius: 6px;
}

.reasoning-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 13px;
  color: #667eea;
}

.reasoning-icon {
  font-size: 16px;
}

.reasoning-content {
  font-size: 13px;
  line-height: 1.6;
  color: #555;
  font-style: italic;
}

.message-text {
  line-height: 1.6;
  font-size: 15px;
}

/* Markdown 样式 */
.message-text >>> h1,
.message-text >>> h2,
.message-text >>> h3,
.message-text >>> h4,
.message-text >>> h5,
.message-text >>> h6 {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
}

.message-text >>> h1 { font-size: 24px; }
.message-text >>> h2 { font-size: 20px; }
.message-text >>> h3 { font-size: 18px; }

.message-text >>> p {
  margin: 8px 0;
}

.message-text >>> code {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.message-text >>> pre {
  background: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 12px 0;
  position: relative;
}

.message-text >>> pre code {
  background: transparent;
  padding: 0;
}

/* Mermaid 代码块样式 */
.message-text >>> .mermaid-block-wrapper {
  position: relative;
  margin: 12px 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.02);
}

.message-text >>> .mermaid-block-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(102, 126, 234, 0.05);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.message-text >>> .mermaid-toggle-btn,
.message-text >>> .mermaid-copy-btn,
.message-text >>> .mermaid-download-btn {
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: #667eea;
  display: flex;
  align-items: center;
  gap: 4px;
}

.message-text >>> .mermaid-toggle-btn:hover,
.message-text >>> .mermaid-copy-btn:hover,
.message-text >>> .mermaid-download-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.5);
}

.message-text >>> .mermaid-code-view,
.message-text >>> .mermaid-chart-view {
  display: none;
}

.message-text >>> .mermaid-code-view[data-view-mode="code"],
.message-text >>> .mermaid-chart-view[data-view-mode="chart"] {
  display: block;
}

.message-text >>> .mermaid-code-view pre {
  margin: 0;
  border-radius: 0;
  background: rgba(0, 0, 0, 0.05);
}

.message-text >>> .mermaid-chart-view {
  padding: 16px;
  text-align: center;
  background: white;
}

.message-text >>> .mermaid-content {
  display: inline-block;
  min-width: 100%;
}

.message-text >>> .mermaid-content svg {
  max-width: 100%;
  height: auto;
}

.message-text >>> .mermaid-error {
  color: #e74c3c;
  padding: 12px;
  background: rgba(231, 76, 60, 0.1);
  border-radius: 4px;
  font-size: 13px;
}

/* 代码块操作按钮样式 */
.message-text >>> .code-block-wrapper {
  position: relative;
  margin: 12px 0;
}

.message-text >>> .code-block-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 6px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-text >>> .code-block-wrapper:hover .code-block-actions {
  opacity: 1;
}

.message-text >>> .code-action-btn {
  background: rgba(102, 126, 234, 0.9);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
  backdrop-filter: blur(4px);
}

.message-text >>> .code-action-btn:hover {
  background: rgba(102, 126, 234, 1);
}

/* 消息操作按钮样式 */
.message-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.message.user .message-actions {
  border-top-color: rgba(255, 255, 255, 0.2);
}

.action-btn {
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  color: #667eea;
}

.action-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  border-color: rgba(102, 126, 234, 0.5);
}

.message.user .action-btn {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
}

.message.user .action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.message-text >>> blockquote {
  border-left: 4px solid #667eea;
  padding-left: 12px;
  margin: 12px 0;
  color: #666;
  font-style: italic;
}

.message-text >>> ul,
.message-text >>> ol {
  margin: 8px 0;
  padding-left: 24px;
}

.message-text >>> li {
  margin: 4px 0;
}

.message-text >>> a {
  color: #667eea;
  text-decoration: none;
}

.message-text >>> a:hover {
  text-decoration: underline;
}

.message-text >>> table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.message-text >>> th,
.message-text >>> td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.message-text >>> th {
  background: rgba(102, 126, 234, 0.1);
  font-weight: 600;
}

.message.user .message-text >>> code {
  background: rgba(255, 255, 255, 0.2);
}

.message.user .message-text >>> pre {
  background: rgba(255, 255, 255, 0.1);
}

/* 插槽样式 */
.message-slots {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.streaming-indicator {
  display: inline-block;
  margin-left: 4px;
}

.cursor {
  animation: blink 1s infinite;
  color: #667eea;
  font-weight: bold;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.loading-dots {
  display: flex;
  gap: 6px;
  padding: 8px 0;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #667eea;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.chat-input-container {
  background: white;
  padding: 20px;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.action-buttons {
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  max-width: 100%;
}

.chat-input {
  flex: 1;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 15px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.3s;
  max-height: 150px;
  overflow-y: auto;
}

.chat-input:focus {
  border-color: #667eea;
}

.chat-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  white-space: nowrap;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-button:active:not(:disabled) {
  transform: translateY(0);
}

.send-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>

<style>
/* Toast 提示样式（全局样式） */
.toast-message {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10000;
  opacity: 0;
  transition: all 0.3s ease;
  pointer-events: none;
}

.toast-message.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}
</style>
