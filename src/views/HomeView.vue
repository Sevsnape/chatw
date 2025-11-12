<template>
  <div class="home">
    <Sidebar
      :chat-history="chatHistory"
      :current-chat-id="currentChatId"
      @new-chat="createNewChat"
      @select-chat="selectChat"
      @delete-chat="deleteChat"
    />
    <ChatComponent
      :messages="currentMessages"
      :show-reasoning="showReasoning"
      @message-added="handleMessageAdded"
      @message-complete="handleMessageComplete"
    >
      <!-- 附加按钮插槽 -->
      <template #action-buttons>
        <!-- <button @click="toggleReasoning" class="action-btn" :class="{ active: showReasoning }">
          {{ showReasoning ? '隐藏思考' : '显示思考' }}
        </button>
        <button @click="clearChat" class="action-btn">
          清空对话
        </button> -->
      </template>
      
      <!-- 图片插槽示例 -->
      <template #image-slot>
        <!-- 可以在这里添加图片显示逻辑 -->
        <!-- 使用示例: <img v-if="message.image" :src="message.image" alt="图片" /> -->
      </template>
      
      <!-- 链接插槽示例 -->
      <template #link-slot>
        <!-- 可以在这里添加链接显示逻辑 -->
        <!-- 使用示例: <a v-if="message.link" :href="message.link" target="_blank">{{ message.link }}</a> -->
      </template>
    </ChatComponent>
  </div>
</template>

<script>
// @ is an alias to /src
import ChatComponent from '@/components/ChatComponent.vue'
import Sidebar from '@/components/SideBar.vue'
import { isReasonerModel } from '@/services/deepseekApi'

export default {
  name: 'HomeView',
  components: {
    ChatComponent,
    Sidebar
  },
  data() {
    return {
      chatHistory: [],
      currentChatId: null,
      currentMessages: [],
      showReasoning: true
    }
  },
  mounted() {
    // 从 localStorage 加载对话历史
    this.loadChatHistory()
    
    // 如果没有对话，创建新对话
    if (this.chatHistory.length === 0) {
      this.createNewChat()
    } else {
      // 加载最新的对话
      const latestChat = this.chatHistory[0]
      this.selectChat(latestChat.id)
    }
    
    // 根据模型判断是否显示思考链
    this.showReasoning = isReasonerModel()
  },
  methods: {
    createNewChat() {
      const newChat = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // 将新对话添加到最前面
      this.chatHistory.unshift(newChat)
      this.currentChatId = newChat.id
      // 确保消息数组为空
      this.currentMessages = []
      this.saveChatHistory()
    },
    
    selectChat(chatId) {
      const chat = this.chatHistory.find(c => c.id === chatId)
      if (chat) {
        this.currentChatId = chatId
        // 确保消息数组存在，如果不存在则使用空数组
        this.currentMessages = chat.messages && chat.messages.length > 0 
          ? JSON.parse(JSON.stringify(chat.messages))
          : []
        // 更新访问时间
        chat.updatedAt = new Date().toISOString()
        // 重新排序，将当前对话移到最前面
        this.chatHistory.sort((a, b) => {
          if (a.id === chatId) return -1
          if (b.id === chatId) return 1
          return new Date(b.updatedAt) - new Date(a.updatedAt)
        })
        this.saveChatHistory()
      }
    },
    
    deleteChat(chatId) {
      const index = this.chatHistory.findIndex(c => c.id === chatId)
      if (index !== -1) {
        this.chatHistory.splice(index, 1)
        this.saveChatHistory()
        
        // 如果删除的是当前对话，切换到其他对话或创建新对话
        if (this.currentChatId === chatId) {
          if (this.chatHistory.length > 0) {
            this.selectChat(this.chatHistory[0].id)
          } else {
            this.createNewChat()
          }
        }
      }
    },
    
    handleMessageAdded(message) {
      const chat = this.chatHistory.find(c => c.id === this.currentChatId)
      if (chat) {
        chat.messages.push(message)
        // 更新标题（使用第一条用户消息）
        if (message.role === 'user' && chat.title === '新对话') {
          chat.title = message.content.substring(0, 20) + (message.content.length > 20 ? '...' : '')
        }
        chat.updatedAt = new Date().toISOString()
        this.saveChatHistory()
      }
    },
    
    handleMessageComplete(message) {
      const chat = this.chatHistory.find(c => c.id === this.currentChatId)
      if (chat) {
        // 更新最后一条助手消息
        const lastMessage = chat.messages[chat.messages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.content = message.content
          lastMessage.reasoning = message.reasoning
          lastMessage.streaming = false
        } else {
          chat.messages.push(message)
        }
        chat.updatedAt = new Date().toISOString()
        this.saveChatHistory()
      }
    },
    
    toggleReasoning() {
      this.showReasoning = !this.showReasoning
    },
    
    clearChat() {
      if (confirm('确定要清空当前对话吗？')) {
        const chat = this.chatHistory.find(c => c.id === this.currentChatId)
        if (chat) {
          chat.messages = []
          this.currentMessages = []
          this.saveChatHistory()
        }
      }
    },
    
    saveChatHistory() {
      try {
        localStorage.setItem('chatHistory', JSON.stringify(this.chatHistory))
      } catch (e) {
        console.error('保存对话历史失败:', e)
      }
    },
    
    loadChatHistory() {
      try {
        const saved = localStorage.getItem('chatHistory')
        if (saved) {
          this.chatHistory = JSON.parse(saved)
          // 按更新时间排序
          this.chatHistory.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        }
      } catch (e) {
        console.error('加载对话历史失败:', e)
        this.chatHistory = []
      }
    }
  }
}
</script>

<style scoped>
.home {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.action-btn {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  color: #666;
}

.action-btn:hover {
  border-color: #667eea;
  color: #667eea;
  background: #f8f9ff;
}

.action-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}
</style>
