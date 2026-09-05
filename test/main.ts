import { CompElem, defineComponents, forEach, h, ifElse, state, tag } from 'compelem'
import { i18n } from './i18n'

const DEMO_DATE = new Date(2026, 8, 4)

/** 工具条：切换语言，观察所有组件与 <html lang> 的联动 */
@tag('x-switcher')
export class XSwitcher extends CompElem {
  render() {
    return h`<div class="toolbar">
      <button @click="${() => i18n.setLocale('zh-CN')}">中文</button>
      <button @click="${() => i18n.setLocale('en')}">English</button>
      <span class="meta">
        ${i18n.t('current')}: ${i18n.locale} / html[lang]: ${document.documentElement.lang}
      </span>
    </div>`
  }
}

/** 主示例：参数插值 / ICU 复数 / d,n 格式化 / 属性绑定 / ifElse / forEach 内的 t() */
@tag('x-cart')
export class XCart extends CompElem {
  @state count = 1
  @state showExtra = true

  fruits = [
    { id: 1, key: 'apple', count: 3 },
    { id: 2, key: 'banana', count: 1 },
    { id: 3, key: 'cherry', count: 5 },
  ]

  render() {
    return h`<section>
      <h2>${i18n.t('title')}</h2>
      <p title="${i18n.t('tip')}">${i18n.t('hello', { name: 'Ken' })}</p>
      <p>
        ${i18n.t('apple', this.count)} |
        ${i18n.d(DEMO_DATE, 'long')} |
        ${i18n.n(1234.5, 'currency')}
      </p>
      <p>
        <button @click="${() => this.count++}">+1</button>
        <button @click="${() => this.count--}">-1</button>
        <button @click="${() => (this.showExtra = !this.showExtra)}">toggle extra</button>
      </p>
      ${ifElse(
        this.showExtra,
        () => h`<p class="extra">${i18n.t('extra')}</p>`,
        () => h`<p class="extra"></p>`
      )}
      <ul>
        ${forEach(this.fruits, (f) => f.id, (f) => h`<li>${i18n.t(f.key, f.count)}</li>`)}
      </ul>
    </section>`
  }
}

defineComponents()
