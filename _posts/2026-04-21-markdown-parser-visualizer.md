---
layout: post
title: 마크다운 파서 + HTML 비주얼라이저 구현
subtitle: Stack이랑 Queue를 괜히 배우는 게 아니었다
date: 2026-04-21 00:00:00 +0900
sitemap :
  changefreq : daily
  priority : 1.0
---

이번에 자료구조 과제로 마크다운 파서를 하나 직접 만들었다.
정확히는 `*italic*`이랑 `**bold**`만 처리하는 아주 작은 파서다.
대신 범위를 줄인 만큼 흐름은 좀 제대로 보이게 짰다.

그냥 문자열 치환 두 번 하고 끝내는 것도 가능은 하다.
근데 그러면 왜 Stack이 필요하고 Queue가 왜 끼는지가 잘 안 보인다.
이번 건 그걸 일부러 드러내는 쪽으로 갔다.

입력 파일 이름을 CLI 인자로 받고, 마크다운을 HTML로 바꾼 다음, `.html` 파일로 저장하고 브라우저에서 바로 열리게 했다.
작은 과제인데도 결과가 바로 눈에 보이니까 생각보다 덜 귀찮고, 테스트하기도 편했다.

## 이번 구현 범위

지원한 문법은 딱 두 개다.

1. `*문자열*` → `<em>문자열</em>`
2. `**문자열**` → `<strong>문자열</strong>`

이 이상은 일부러 안 넣었다.
헤더, 링크, 리스트, 코드블럭까지 손대기 시작하면 자료구조 과제라기보다 예외처리 지옥이 되기 때문이다.
이번 목표는 “마크다운 전부 구현”이 아니라, **파서 흐름을 직접 만드는 것**에 더 가까웠다.

## 파일 구성

작업한 파일은 이렇게 나눴다.

```text
data_structures.py
markdown_parser.py
main.py
sample.md
test_parser.py
```

`data_structures.py`에는 `Stack`, `Queue`를 따로 뒀고,
`markdown_parser.py`에는 토큰화랑 파싱 로직을 넣었다.
`main.py`는 입력 파일 받고 HTML 저장하고 브라우저 여는 쪽이다.

역할을 이렇게 쪼개두니까 어디가 잘못됐는지 찾기 편했다.
작은 프로그램이어도 파일별 책임을 나눠두는 쪽이 덜 꼬인다.

## 왜 Queue부터 쓰게 했나

입력 문자열은 왼쪽부터 읽는다.
그리고 한 번 읽은 토큰은 다시 뒤로 돌려보낼 이유가 없다.
그래서 토크나이저 단계는 `Queue`가 제일 자연스러웠다.

문자열을 훑으면서 토큰을 만들고, 그걸 바로 `enqueue()` 하게 만들었다.

```python
while index < len(text):
    if text[index:index + 2] == "**":
        queue.enqueue(("MARKER", "**"))
        index += 2
    elif text[index] == "*":
        queue.enqueue(("MARKER", "*"))
        index += 1
    else:
        queue.enqueue(("TEXT", chunk))
```

여기서 중요한 건 `**`를 먼저 보는 거다.
이걸 안 하면 `**bold**`가 `*` 두 개로 찢어져서 파싱이 이상해진다.
사소해 보이는데 이 순서 하나가 꽤 중요했다.

## parser는 Stack으로 상태를 봤다

토큰을 `Queue`에 넣었으면, 파서는 그걸 앞에서부터 하나씩 `dequeue()` 하며 읽는다.
이때 `TEXT`는 그냥 HTML 결과에 붙이면 된다.
문제는 `*`, `**` 같은 마커다.

이 마커가 지금 여는 건지, 닫는 건지 판단해야 한다.
그래서 `Stack`을 썼다.

```python
token_type, token_value = queue.dequeue()

if token_type == "TEXT":
    output.append(escape_html(token_value))
elif not stack.is_empty() and stack.peek() == token_value:
    stack.pop()
    output.append(closing_tag(token_value))
else:
    stack.push(token_value)
    output.append(opening_tag(token_value))
```

같은 타입의 마커가 스택 꼭대기에 있으면 닫는 태그,
없으면 여는 태그로 처리했다.

이 방식이 좋은 이유는 단순하다.
지금 열린 강조 상태를 문자열 전체에서 다시 찾지 않아도 된다.
파서가 순서대로 읽고, 순서대로 상태를 쌓는다는 느낌이 훨씬 잘 살아난다.

## 구현하면서 좋았던 점

이번 구현은 문법이 많지 않아서 오히려 흐름이 더 잘 보였다.

1. 문자열을 읽는다.
2. 토큰으로 쪼갠다.
3. `Queue`에 넣는다.
4. 파서가 `Queue`에서 꺼낸다.
5. 강조 상태는 `Stack`으로 관리한다.
6. HTML 문자열을 만든다.

말 그대로 입력을 흘리고, 상태를 쌓고, 태그를 닫는 구조다.
교과서에서 보던 Stack, Queue가 실제로 어디에 붙는지 감이 좀 왔다.

그리고 이번엔 `<`, `>`, `&` 같은 문자도 HTML escape 하게 넣었다.
안 그러면 출력이 깨질 수 있어서 이건 그냥 바로 처리하는 게 맞았다.

## CLI로 파일 이름 받게 한 이유

입력 파일은 하드코딩하지 않았다.
실행할 때 파일 이름을 넘기도록 만들었다.

```bash
python main.py sample.md
```

이렇게 해두면 `sample.md` 말고 다른 파일도 바로 넣어서 테스트할 수 있다.
과제 제출할 때도 실행 방법이 명확해서 덜 구질구질하다.

그리고 출력 파일은 입력 이름 기준으로 `.html` 확장자를 붙여 만들게 했다.
`sample.md`를 넣으면 `sample.html`이 생기는 식이다.

## HTML 파일까지 바로 열리게 했다

이 부분이 은근히 편했다.
파싱 끝난 뒤 파일 저장만 하고 끝내지 않고, 기본 브라우저로 바로 열리게 붙였다.

```python
output_path.write_text(html, encoding="utf-8")
webbrowser.open(uri)
```

작은 기능인데 확인 속도가 확 빨라진다.
파일 탐색기 들어가서 더블클릭하고 새로고침하고 이걸 안 해도 되기 때문이다.
이런 건 화려하진 않은데 작업 피로를 꽤 줄여준다.

## sample.md랑 test_parser.py

`sample.md`는 그냥 예제 파일이 아니라 수동 테스트용이었다.
이탤릭, 볼드, 중첩 비슷한 케이스를 넣고 바로 눈으로 확인했다.

`test_parser.py`도 따로 만들었다.
여기서는 적어도 다음 같은 건 바로 체크하게 했다.

```python
assert parse_markdown("*italic*") == "<em>italic</em>"
assert parse_markdown("**bold**") == "<strong>bold</strong>"
assert parse_markdown("hello *world*") == "hello <em>world</em>"
```

이런 테스트가 있으니까 토크나이저 순서 조금 건드려도 바로 티가 난다.
눈으로만 보면 놓칠 수 있는 부분을 잡아주는 최소한의 안전장치 정도는 됐다.

## 마무리

기능만 보면 엄청 거창한 프로그램은 아니다.
근데 작아서 오히려 파서 구조가 잘 보였다.

특히 이번엔 왜 `Queue`로 흘리고, 왜 `Stack`으로 상태를 보는지가 꽤 납득됐다.
자료구조 시간에 배우는 게 괜히 나오는 건 아니었다.

다음에 범위를 더 넓히면 링크나 제목 같은 것도 붙일 수는 있겠지만,
이번 과제에서는 여기까지가 제일 깔끔했다.
작고, 보이고, 디버깅하기 쉬운 쪽.

---

## sources, footnotes

Source: 직접 작성한 `data_structures.py`, `markdown_parser.py`, `main.py`, `sample.md`, `test_parser.py`
