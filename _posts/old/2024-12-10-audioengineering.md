---
layout: post
title: 그냥 음향공학 공부
subtitle:
date: 2024-12-10 00:49:00 +0900
sitemap :
  changefreq : daily
  priority : 1.0
---

<!-- 
2024 1111 쪽지시험 ?회차 
10-1
<https://www.youtube.com/playlist?list=PLWIO_-9OHaQg25v5pAMZX_wVQVTLTUBtW> -->

# effector

## 효과기 분류

### 음량 제어계
- 컴프레서, 리미터, 익스팬더, 노이즈 게이터
### 음색 변환계
- 그래픽 이퀄라이저, Parametric EQ, 필터
### 시간 제어계
- 지연기, 플랜저, 코러스, 피치가변기, 하모나이저, 잔향기
### 기타: auto pan, exciter, de-esser, 왜곡 발생기, 입체 음향 제어기

## 음량 제어 효과기

### compressor, limiter
- threshold(경계)보다 큰 입력 신호의 음량을 정해진 비율로 줄임
- 1:10이상으로 압축하면 limiter
- 설정 파라미터 1:
  - threshold, ratio
- 설정 파라미터 2:
  - attack time, release time, hard knee & soft knee
### expander
- threshold보다 작은 음량 입력을 정해진 비율로 줄임
### noise gate
- threshold보다 작은 음량 입력 소거
### equalizer
- 소리의 주파수 대역별로 음량 조절
- 여러 개의 filter 회로
#### graphic eq:
- 주파수 대역별로 슬라이더
- 슬라이더 조정으로 해당 주파수 대역 음량 가변
- band 수:
  - 0-20kHz를 나눈 것 (10band = 10 octave, 31band = 1/3 octave e.q.)
#### parametric eq
- 변경할 주파수 대역 중심 주파수, 대역 폭 Q, 이득 설정 가능
- Q 클수록 대역폭 좁아짐

# Digital Audio

## 아날로그신호 -> 디지털 변환

- 신호: 정보가 들어있는 물리적 파형
- 아날로그 신호
  - 파형 모양이 시간에 따라 연속적으로 변함
  - 신호의 파형 모양 자체가 정보
- 디지털 신호
  - 0, 1 조합의 정보

### 디지털화 과정

- 아날로그 신호
- 표본화 sampling 
- 양자화 quantization
- 부호화 coding
- 디지털 신호

#### sampling
- 일정한 시간 간격으로 신호 추출 과정
- 샘플링 주파수 = 1초 동안 샘플링 수
- 일반적인 디지털 오디오의 샘플링 주파수 = 44100Hz
- 샘플링 주파수가 높을수록 원래 파형과 비슷해짐
- 앨리어싱: 샘플링율이 낮을 때 원래 신호와 차이 커서 잡음 생김
  - 줄이려면 아날로그 신호가 가진 최고 주파수 성분의 2배 이상의 샘플링율 사용
- **샘플링 주파수 fs인 디지털 데이터는 fs/2(Hz)까지의 정보만 들어있음**
  - **fs = 44100Hz 오디오는 0-22050Hz까지의 소리 정보만 들어있음**

#### quantization
- 각 샘플의 값을 구간별로 묶는 작업
- 양자화 레벨, 부호화:
  - 1bit - 2구간, 2bit - 4구간, 3bit - 8구간
  - Bbit - N구간
- dynamic range: 가장 작은 소리와 가장 큰 소리와의 차이
  - > 16비트 양자화일 경우 구간 수 65536, 0-65535까지 표현, $20 \log 65535 = 96.3dB$
  - > 24비트 경우 16777216, $20 \log 16777215 = 144.5dB$

### 비트율 bit rate

- 1초간 저장에 필요한 bit 양
  - 샘플링 주파수 * 양자화 비트 * 채널 수 e.g. $44100*16*2=1,411,200bps$
  - 단위: bps bits per second
  - 값이 클 수록 데이터 많고 고음질

### CD 오디오 

- 샘플링 주파수 = 44.1kHz
- 양자화 16비트 = 65536개 구간

### SACD super audio cd

- cd보다 더 높은 주파수 저장하는 디지털 매체
- 1999년 sony, philips 개발
- 기존 cd와 호환 불가, 전용 플레이어 필요
- 사양
  - 1bit 양자화, 2.8224MHz 샘플링된 DSD 방식
  - 다채널 저장 가능
  - 105dB DR
  - 20Hz - 50kHz 재생

### DVD-Audio

- 샘플링, 양자화
  - CD와 동일한 PCM 방식
  - 2채널 최대 24/192
  - DR: 144dB

## 오디오 압축 

### 무압축
- 원래 오디오 데이터 용량 줄이지 않음. 부가 정보만 추가하거나 데이터 저장 방식만 바꿈(e.g. wave)

### 압축
- 오디오 데이터의 용량 줄여서 저장
#### 무손실 압축(lossless compression): 
- 원 데이터의 손상 없게 압축하고 압축 풀면 원래 데이터 그대로 복원 e.g. FLAC
#### 손실 압축(lossy compression): 
- 원 데이터 분석하여 인간의 귀에 들리지 않는 소리를 삭제해서 데이터 압축
- 원 데이터 손상되기 때문에 원래 데이터로 복원 불가
- 압축률은 엔트로피 코딩보다 높음 
- e.g. MP3, AAC

# Cable

## 케이블 종류
- 실드 케이블
- 스피커 케이블
- AES/EBU 디지털 케이블
- 광 케이블

### shield cable
- shield: 가는 동선, 얇은 알루미늄 등으로 내부 전선 감싼 구조
- 외부에서 유입되는 전자기파 잡음 차단
- 실드로 인해 고음 영역에서 신호 손실 있음
- 저 레벨 기기에서 주로 사용

> 참고: 스피커의 등가회로

### 스피커 케이블

- 2심/4심 케이블은 쉴드가 없다

### 음향 시스템 신호 레벨과 케이블

- 마이크 레벨(-60~-20dBV. 1-20mV)
  - 낮은 신호 레벨
  - 외부 노이즈 유입 방지 위해 실드 사용
- 스피커 레벨(1-100V)
  - 높은 신호 레벨, 잡음 유입돼도 영향 적음

### 기타 케이블

- AES/EBU 디지털 케이블
- 광케이블
- 동축케이블

## 커넥터, plug

### TRS 폰 플러그
- 1/4인치 phone plug

### XLR, 캐논 커넥터
- 1 접지
- 2 Hot(+)
- 3 Cold(-)
- EIA RS-297-A 표준

### Unbalanced cable 불평형형 케이블
- 신호와 접지만 연결
- Balanced: 정위상신호와 역위상신호를 혼입, 잡음 줄임

### XLR-TRS 연결
- 1 접지 - Sleeve
- 2 Hot+ - tip
- 3 cold- - ring

### Speakon 커넥터
- 앰프-스피커 사이 연결, Neutrik사 상표명

### RCA
- 1940 개발, A/V 신호 전송 케이블

### HDMI: High Definition *Multimedia* Interface