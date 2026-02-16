import { useState } from 'react';

export function HuManual() {
  const [show, setShow] = useState(false);

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: 8,
      zIndex: 100,
      background: 'rgba(0,0,0,0.85)',
      borderRadius: 8,
      color: 'white',
      fontSize: 13,
      maxWidth: show ? 280 : 'auto',
    }}>
      <button
        onClick={() => setShow(!show)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#ffcc00',
          cursor: 'pointer',
          padding: '8px 12px',
          fontSize: 13,
          width: '100%',
          textAlign: 'left',
        }}
      >
        {show ? '▼ 胡牌说明' : '▶ 胡牌说明'}
      </button>
      {show && (
        <div style={{ padding: '0 12px 12px 12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #555' }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>番型</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>分数</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>平胡</td><td style={{ textAlign: 'right' }}>10</td></tr>
              <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 需门前清</td></tr>
              <tr><td>对对胡</td><td style={{ textAlign: 'right' }}>30</td></tr>
              <tr><td>混一色</td><td style={{ textAlign: 'right' }}>30</td></tr>
              <tr><td>七对</td><td style={{ textAlign: 'right' }}>50</td></tr>
              <tr><td>清一色</td><td style={{ textAlign: 'right' }}>50</td></tr>
              <tr><td>全球独钓</td><td style={{ textAlign: 'right' }}>50</td></tr>
              <tr><td>全幺九</td><td style={{ textAlign: 'right' }}>100</td></tr>
              <tr><td>小三元</td><td style={{ textAlign: 'right' }}>100</td></tr>
              <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 332</td></tr>
              <tr><td>字一色</td><td style={{ textAlign: 'right' }}>100</td></tr>
              <tr><td>大三元</td><td style={{ textAlign: 'right' }}>200</td></tr>
              <tr><td>小四喜</td><td style={{ textAlign: 'right' }}>200</td></tr>
              <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 332</td></tr>
              <tr><td>大四喜</td><td style={{ textAlign: 'right' }}>300</td></tr>
              <tr><td>风碰</td><td style={{ textAlign: 'right' }}>300</td></tr>
              <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 需一句话</td></tr>
              <tr><td>十三幺</td><td style={{ textAlign: 'right' }}>1000</td></tr>
              <tr style={{ color: '#aaa', fontSize: 11 }}><td colSpan={2}>└ 其中一种需2张</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #555', fontSize: 11, color: '#aaa' }}>
            <p style={{ margin: '4px 0' }}>● 花牌：每朵 +1 分</p>
            <p style={{ margin: '4px 0' }}>● 多番型可叠加计分</p>
            <p style={{ margin: '4px 0' }}>● 杠上开花翻倍（连续杠×2×2...）</p>
          </div>
        </div>
      )}
    </div>
  );
}
