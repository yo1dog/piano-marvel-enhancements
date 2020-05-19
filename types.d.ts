declare const GM: any;
declare const WebMidi: any;

declare function TRequireQuerySelector(parent: HTMLElement, selectors: string): HTMLElement;
declare function TRequireQuerySelector<T extends keyof HTMLElementTagNameMap>(parent: HTMLElement, selectors: string, tagName?: T): HTMLElementTagNameMap[T];