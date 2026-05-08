# SmartRead Echo BDD

## Phase 1: 書名搜尋

### Scenario: 使用者輸入書名時看到候選版本
Given 使用者在 `找書` 輸入一本中文或英文書名  
When 前端呼叫 `GET /api/books/search?q=...`  
Then 畫面會顯示候選書名、作者、ISBN、頁數、來源與封面  
And 如果部分外部來源失敗，仍會顯示可用結果與明確提示

### Scenario: 使用者選定一本書
Given 搜尋結果中存在多個版本  
When 使用者點選其中一本  
Then 前端會先帶入現有 metadata  
And 再呼叫 `POST /api/books/calibrate` 校正頁數、出版社、來源與 ISBN

## Phase 2: 書籍資料校正

### Scenario: 資料源頁數互相衝突
Given 同一本書在不同來源出現 86 頁與 312 頁兩種頁數  
When 系統校正 metadata  
Then 應避免採用明顯偏小的異常值  
And 應回傳較合理的頁數版本

### Scenario: 已知來源頁面時重新校正
Given 使用者書櫃中的書已保存 `sourceUrl`  
When 使用者點擊重新校正  
Then `POST /api/books/calibrate` 會優先使用該來源參與比對  
And 更新總頁數、出版社、來源與封面

## Phase 3: 目錄擷取

### Scenario: 已知商品頁來源時擷取目錄
Given 一本書已保存 `sourceUrl`  
When 使用者點擊 `擷取目錄`  
Then 前端會呼叫 `POST /api/books/catalog`  
And 伺服器會優先直接抓取 `sourceUrl`  
And 回傳章節目錄以更新書櫃詳情

### Scenario: 無法擷取目錄時
Given 商品頁沒有可用目錄  
When 目錄擷取結束  
Then 前端會保留原本 metadata  
And 顯示找不到可用目錄來源的提示

## Phase 4: 儲存與相容性

### Scenario: 舊版 localStorage 升級
Given 使用者瀏覽器中仍保存舊版書籍資料  
When App 啟動並載入 persisted state  
Then migration 會自動補齊 `publisher`、`source`、`sourceUrl` 與 `catalog`  
And 不會造成書櫃或筆記資料遺失
