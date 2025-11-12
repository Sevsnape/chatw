<template>
  <div class="sidebar" :class="{ collapsed: isCollapsed }">
    <div class="sidebar-header">
      <button @click="toggleCollapse" class="collapse-btn">
        <span v-if="!isCollapsed">☰</span>
        <span v-else>☰</span>
      </button>
      <h3 v-if="!isCollapsed">对话历史</h3>
    </div>
    
    <div v-if="!isCollapsed" class="sidebar-content">
      <button @click="createNewChat" class="new-chat-btn">
        <span class="icon">+</span>
        <span>新建对话</span>
      </button>
      
      <div class="chat-list">
        <div
          v-for="(chat, index) in chatHistory"
          :key="chat.id"
          :class="['chat-item', { active: currentChatId === chat.id }]"
          @click="selectChat(chat.id)"
        >
          <div class="chat-item-content">
            <div class="chat-title">{{ chat.title || `对话 ${index + 1}` }}</div>
            <div class="chat-preview">{{ getChatPreview(chat) }}</div>
            <div class="chat-time">{{ formatTime(chat.updatedAt) }}</div>
          </div>
          <button
            @click.stop="deleteChat(chat.id)"
            class="delete-btn"
            title="删除对话"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SideBar',
  props: {
    chatHistory: {
      type: Array,
      default: () => []
    },
    currentChatId: {
      type: String,
      default: null
    }
  },
  data() {
    return {
      isCollapsed: false
    }
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
    },
    createNewChat() {
      this.$emit('new-chat')
    },
    selectChat(chatId) {
      this.$emit('select-chat', chatId)
    },
    deleteChat(chatId) {
      if (confirm('确定要删除这个对话吗？')) {
        this.$emit('delete-chat', chatId)
      }
    },
    getChatPreview(chat) {
      if (chat.messages && chat.messages.length > 0) {
        const lastMessage = chat.messages[chat.messages.length - 1]
        if (lastMessage.content) {
          return lastMessage.content.substring(0, 30) + (lastMessage.content.length > 30 ? '...' : '')
        }
      }
      return '暂无消息'
    },
    formatTime(timestamp) {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)
      
      if (minutes < 1) return '刚刚'
      if (minutes < 60) return `${minutes}分钟前`
      if (hours < 24) return `${hours}小时前`
      if (days < 7) return `${days}天前`
      
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }
  }
}
</script>

<style scoped>
.sidebar {
  width: 280px;
  background: #2c3e50;
  color: white;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  border-right: 1px solid #34495e;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar-header {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #34495e;
  min-height: 60px;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.collapse-btn {
  background: transparent;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.new-chat-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.new-chat-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.new-chat-btn .icon {
  font-size: 20px;
  font-weight: bold;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
}

.chat-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.chat-item.active {
  background: rgba(102, 126, 234, 0.3);
  border: 1px solid rgba(102, 126, 234, 0.5);
}

.chat-item-content {
  flex: 1;
  min-width: 0;
}

.chat-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-preview {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.delete-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 24px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  opacity: 0;
  margin-left: 8px;
}

.chat-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.2);
}

/* 滚动条样式 */
.sidebar-content::-webkit-scrollbar {
  width: 6px;
}

.sidebar-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>

