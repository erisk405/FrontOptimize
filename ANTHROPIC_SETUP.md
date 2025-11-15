# การตั้งค่า Anthropic (Claude) สำหรับ AI Frontend Optimizer

## วิธีการเปลี่ยนจาก OpenAI เป็น Anthropic

### 1. **เปลี่ยน AI Provider**
1. เปิด VSCode Settings (`Ctrl+,`)
2. ค้นหา "AI Frontend Optimizer"
3. เปลี่ยน **AI Provider** จาก `openai` เป็น `anthropic`

### 2. **เลือก Claude Model**
เปลี่ยน **Model** เป็นหนึ่งใน Claude models:
- **`claude-3-5-sonnet-20241022`** (แนะนำ) - สมดุลระหว่างคุณภาพและราคา
- **`claude-3-opus-20240229`** - คุณภาพดีที่สุด แต่แพงที่สุด
- **`claude-3-5-haiku-20241022`** - เร็วและประหยัดที่สุด

### 3. **ตั้งค่า Anthropic API Key**

#### วิธีที่ 1: ใช้ Command Palette (แนะนำ)
1. กด `Ctrl+Shift+P`
2. พิมพ์ "AI Frontend Optimizer: Configure API Key"
3. ใส่ Anthropic API key ของคุณ (เริ่มต้นด้วย `sk-ant-`)

#### วิธีที่ 2: ใส่ใน Settings (ไม่แนะนำ)
1. เปิด VSCode Settings
2. ค้นหา "aiFrontendOptimizer.apiKey"
3. ใส่ API key (แต่จะถูกย้ายไป secure storage อัตโนมัติ)

### 4. **รับ Anthropic API Key**
1. ไปที่ [https://console.anthropic.com/](https://console.anthropic.com/)
2. สร้างบัญชีหรือเข้าสู่ระบบ
3. ไปที่ "API Keys" section
4. สร้าง API key ใหม่
5. คัดลอก key (จะเริ่มต้นด้วย `sk-ant-`)

## การทดสอบ

1. **เปิดไฟล์ Angular component** (`.ts`, `.html`, หรือ `.css`)
2. **คลิกขวา** → เลือก **"AI Optimize this file"**
3. **ตรวจสอบ** ว่าไม่มี error เกี่ยวกับ API key
4. **ดูผลลัพธ์** ใน Results Panel

## การแก้ไขปัญหา

### "Invalid API key" Error
- ตรวจสอบว่า API key ถูกต้อง (เริ่มต้นด้วย `sk-ant-`)
- ตรวจสอบว่า AI Provider ตั้งเป็น `anthropic`
- ลองตั้งค่า API key ใหม่ด้วย Command Palette

### Model ไม่ตรงกับ Provider
- ถ้าใช้ Anthropic ต้องเลือก Claude models (`claude-3-*`)
- ถ้าใช้ OpenAI ต้องเลือก GPT models (`gpt-*`)

## ความแตกต่างระหว่าง OpenAI และ Anthropic

| Feature | OpenAI (GPT) | Anthropic (Claude) |
|---------|--------------|-------------------|
| **API Key Format** | `sk-...` | `sk-ant-...` |
| **Best Model** | `gpt-4` | `claude-3-5-sonnet-20241022` |
| **Speed** | Medium | Fast |
| **Cost** | $$$ | $$ |
| **Code Analysis** | Excellent | Excellent |
| **Context Length** | 8K-32K tokens | 200K tokens |

## การตั้งค่าเพิ่มเติม

```json
{
  "aiFrontendOptimizer.aiProvider": "anthropic",
  "aiFrontendOptimizer.model": "claude-3-5-sonnet-20241022",
  "aiFrontendOptimizer.analyzerTimeout": 45,
  "aiFrontendOptimizer.verboseLogging": true
}
```

## ข้อดีของ Claude

- **Context ยาวกว่า**: รองรับไฟล์ใหญ่ได้ดีกว่า
- **ราคาถูกกว่า**: โดยเฉพาะ Claude 3 Haiku
- **ความแม่นยำสูง**: ในการวิเคราะห์โค้ด
- **ความปลอดภัย**: มีการควบคุมเนื้อหาที่ดี
