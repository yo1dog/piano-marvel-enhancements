export function createHTML(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

export function requireQuerySelector(parent: ParentNode, selectors: string): HTMLElement;
export function requireQuerySelector<T extends keyof HTMLElementTagNameMap>(parent: ParentNode, selectors: string, tagName: T): HTMLElementTagNameMap[T];
export function requireQuerySelector(parent: ParentNode, selectors: string, tagName?: keyof HTMLElementTagNameMap): HTMLElement {
  const elem = parent.querySelector(selectors);
  if (!elem) {
    throw new Error(`Unable to find ${selectors}`);
  }
  if (tagName && !checkTag(elem, tagName)) {
    throw new Error(`Found ${selectors} but it is a <${elem.tagName}> and not <${tagName}>`);
  }
  return elem as HTMLElement;
}

export function checkTag<T extends keyof HTMLElementTagNameMap>(elem: Element, tagName: T): elem is HTMLElementTagNameMap[T] {
  return elem.tagName.toUpperCase() === tagName.toUpperCase();
}

export function clampArrayFromEnd(arr: unknown[], maxLength: number) {
  if (arr.length > maxLength) {
    arr.splice(0, arr.length - maxLength);
  }
}

export function notesToString(notes: INote[]) {
  return notes.map(note => `${note.name}${note.octave}`).join(', ');
}