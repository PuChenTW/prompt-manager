---
trigger: always_on
---

# Prompt Manager - Chrome Extension

一個輕量化的 Chrome 擴充功能，用於管理和快速插入 Prompt 模板。

## 功能需求 (User Requirements Document)

### 1. 核心功能

#### 1.1 Prompt 管理
- **新增 Prompt**：使用者可以建立新的 Prompt 模板，包含：
  - 標題（Title）：用於識別該 Prompt
  - 內容（Content）：Prompt 的完整文字內容
  - 支援變數標記：使用 `{{variable}}` 格式標記需要替換的變數位置

- **編輯 Prompt**：點擊 Prompt 卡片即可開啟編輯視窗
- **刪除 Prompt**：每個卡片右側有 Delete 按鈕
- **清單瀏覽**：在設定頁面顯示所有已儲存的 Prompt 清單，長內容自動以省略號顯示

#### 1.2 Prompt 插入
- **右鍵選單插入**：
  - 在任何可編輯區域（輸入框、Textarea、contenteditable 元素）按右鍵
  - 選單中顯示「Prompt Manager」及其子選單
  - 點擊特定 Prompt 即可插入到目標輸入框

- **變數自動定位**：
  - 插入 Prompt 後，自動偵測第一個 `{{variable}}` 的位置
  - 將游標移動至該變數並自動選取，方便使用者直接輸入替換

#### 1.3 資料儲存
- 使用 `chrome.storage.local` 儲存 Prompt 資料（容量約 5MB+）
- 資料格式：
  ```json
  {
    "prompts": [
      {
        "id": "timestamp_string",
        "title": "Prompt 標題",
        "content": "Prompt 內容，支援 {{variable}} 變數"
      }
    ]
  }
  ```

### 2. 使用者介面

#### 2.1 設定頁面 (Options Page)
- **現代化設計**：
  - 漸層背景（淡藍灰漸層）
  - 紫藍漸層主色調
  - Inter 字體提升可讀性
  - 卡片式佈局搭配多層陰影系統

- **Prompt 清單**：
  - 點擊擴充功能圖示開啟設定頁面（在新分頁中）
  - 顯示所有已儲存的 Prompt 清單
  - 提供「+ Add Prompt」按鈕新增 Prompt
  - 每個 Prompt 卡片：
    - 標題與內容預覽（最多 3 行，超過顯示 `...`）
    - 點擊卡片任意處即可編輯
    - Delete 按鈕：刪除該 Prompt
    - Hover 效果：卡片右移 + 背景變色

#### 2.2 編輯對話框 (Modal)
- **大尺寸設計**：寬度 80%，最大 1200px，方便閱讀長 Prompt
- **玻璃擬態效果**：背景模糊 + 半透明遮罩
- **動畫效果**：滑入 + 淡入動畫
- **表單元素**：
  - 標題輸入框
  - 內容輸入框（多行，280px 高度）
  - Focus 狀態：藍色邊框 + 光暈效果
  - Cancel 與 Save 按鈕

#### 2.3 右鍵選單 (Context Menu)
- 僅在可編輯區域時顯示
- 父選單：「Prompt Manager」
- 子選單：動態顯示所有已儲存的 Prompt 標題

### 3. 技術特性

#### 3.1 相容性
- **網站支援**：所有網站（`<all_urls>`）
- **輸入框支援**：
  - `<textarea>` 元素
  - `<input>` 元素
  - `contenteditable` 元素（如 ChatGPT、Claude 等）

#### 3.2 注入機制
- 使用 `document.execCommand('insertText')` 模擬真實使用者輸入
- 觸發 `input` 事件以確保 React/Next.js 等框架正確更新狀態
- 追蹤右鍵點擊位置，即使焦點切換也能正確插入

#### 3.3 效能與安全
- 輕量化設計，最小化資源佔用
- 僅在需要時載入 Content Script
- 使用 Manifest V3 標準

### 4. 使用流程

#### 4.1 初次設定
1. 安裝擴充功能
2. 點擊擴充功能圖示開啟設定頁面
3. 點擊「Add Prompt」建立第一個 Prompt 模板
4. 輸入標題與內容（可使用 `{{variable}}` 標記變數）
5. 點擊 Save 儲存

#### 4.2 日常使用
1. 在任何網站的輸入框上按右鍵
2. 選擇「Prompt Manager」→ 選擇想使用的 Prompt
3. Prompt 自動插入，游標移至第一個變數位置
4. 輸入變數內容，完成 Prompt 使用

#### 4.3 管理 Prompt
1. 點擊擴充功能圖示開啟設定頁面
2. 在清單中找到要編輯或刪除的 Prompt
3. 點擊 Edit 修改，或點擊 Delete 刪除

### 5. 使用情境範例

#### 範例 1：財經分析師 Prompt
```
標題：Financial Analyst
內容：Act as a financial analyst. Analyze the following data: {{data}}
```

使用時：右鍵選單 → Financial Analyst → 游標自動選取 `{{data}}` → 輸入資料

#### 範例 2：程式碼審查 Prompt
```
標題：Code Reviewer
內容：Please review the following {{language}} code and provide feedback on:
1. Code quality
2. Performance
3. Security

Code:
{{code}}
```

使用時：右鍵選單 → Code Reviewer → 游標自動選取第一個 `{{language}}` → 輸入語言名稱 → Tab/手動導航至 `{{code}}` → 貼上程式碼

### 6. 限制與注意事項

1. **變數定位限制**：目前僅自動定位到第一個變數，後續變數需手動導航
2. **iframe 支援**：部分複雜的 iframe 結構可能需要額外處理
3. **儲存限制**：使用 `chrome.storage.local` 有容量限制（約 5MB+）

### 7. 未來可能擴充功能

- 支援 Prompt 分類/標籤
- 支援匯入/匯出 Prompt 集合
- 支援 Prompt 範本變數預設值
- 鍵盤快捷鍵支援
- 多變數智慧導航
