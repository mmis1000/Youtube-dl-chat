type Segment = {
  type: 'text'
  text: string
} | {
  type: 'image'
  image: string
}

interface Line {
  id: string
  name: string;
  color: string;
  head: string;
  badges: ({ type: 'url', url: string } | { type: 'icon', icon: 'moderator' })[];
  message: Segment[];
  time: string;
}

const items = document.querySelector<HTMLDivElement>('.items')!;

const MODERATOR_ICON = document.importNode(document.querySelector<HTMLTemplateElement>('template#moderator-icon')!.content.querySelector('svg')!, true)

async function printLines(lines: Line[], paddingVertical: number = 0) {
  items.style.paddingTop = `${paddingVertical}px`
  items.style.paddingBottom = `${paddingVertical}px`

  items.innerHTML = ''

  const elements: [id: string, element: HTMLDivElement][] = []

  const waitingImages: Promise<void>[] = []

  const createImage = (src: string) => {
    const image = document.createElement('img')

    const waiting = new Promise<void>(resolve => {
      image.addEventListener('error', () => resolve())
      image.addEventListener('load', () => resolve())

      image.src = src

      if (image.complete) {
        resolve()
      }
    })

    waitingImages.push(waiting)
    return image
  }

  for (let line of lines) {
    const message = document.createElement('div');
    message.className = 'message';

    elements.push([line.id, message])

    {
      const headWrapper = document.createElement('div');
      headWrapper.className = 'headWrapper';
      message.appendChild(headWrapper);

      const head = createImage(line.head);
      head.className = 'head';
      headWrapper.appendChild(head);

      message.appendChild(headWrapper);
    }

    {
      const messageWrapper = document.createElement('div');
      messageWrapper.className = 'messageWrapper';

      const messageWrapperInner = document.createElement('div');
      messageWrapperInner.className = 'inner';
      messageWrapper.appendChild(messageWrapperInner);

      // name section
      const nameWrapper = document.createElement('span');
      nameWrapper.className = 'nameWrapper'
      messageWrapperInner.appendChild(nameWrapper)
      {
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = line.name;
        name.style.color = line.color;
        nameWrapper.appendChild(name);

        for (const [index, badge] of line.badges.entries()) {
          let item: HTMLElement
          if (badge.type === 'url') {
            const image = item = createImage(badge.url);
            image.className = 'badge'
            nameWrapper.appendChild(image);
          } else {
            const svgWrapper = item = document.createElement('div');
            svgWrapper.className = 'badge'
            svgWrapper.style.color = line.color

            const svgIcon = MODERATOR_ICON.cloneNode(true);
            svgWrapper.appendChild(svgIcon)

            nameWrapper.appendChild(svgWrapper)
          }
        }
      }

      for (let seg of line.message) {
        if (seg.type === 'text') {
          const text = document.createTextNode(seg.text)
          messageWrapperInner.appendChild(text);
        } else if (seg.type === 'image') {
          const image = createImage(seg.image);
          image.className = 'image';
          messageWrapperInner.appendChild(image);
        }
      }

      message.appendChild(messageWrapper);
    }

    items.appendChild(message);
  }

  await Promise.all(waitingImages)

  const rect = items.getBoundingClientRect()
  const areas = elements.map(e => {
    const rect = e[1].getBoundingClientRect()
    const marginTop = Number(getComputedStyle(e[1]).marginTop.replace('px', ''))
    const marginBottom = Number(getComputedStyle(e[1]).marginBottom.replace('px', ''))
    const height = rect.height + marginTop + marginBottom
    const offset = rect.top - marginTop
    return {
      id: e[0],
      height,
      offset
    }
  })

  return {
    height: rect.height,
    areas
  }
}