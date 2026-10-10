import { Icon } from './Icon.tsx'
import { Modal } from './Modal.tsx'

const SHORTCUTS: [string[], string][] = [
  [['Chuột phải'], 'Đánh dấu ô trống ×'],
  [['X'], 'Đổi công cụ Tô ô / Đánh dấu'],
  [['←', '↑', '→', '↓'], 'Di chuyển ô chọn (hoặc W A S D)'],
  [['Space', 'Enter'], 'Dùng công cụ tại ô chọn'],
  [['Z', 'Backspace'], 'Hoàn tác'],
  [['Y', 'Shift Z'], 'Làm lại'],
  [['H'], 'Gợi ý'],
  [['P'], 'Tạm dừng / tiếp tục'],
  [['N'], 'Đề mới'],
]

/** Indexed by demo cell value: 0 = blank, 1 = filled, 2 = crossed, 3 = forced by overlap. */
const DEMO_CELL = ['demo-cell', 'demo-cell is-filled', 'demo-cell is-crossed', 'demo-cell is-forced']

function DemoRow({ clue, cells }: { clue: string; cells: number[] }) {
  return (
    <div className="demo-row" aria-hidden="true">
      <span className="demo-clue">{clue}</span>
      <span className="demo-cells">
        {cells.map((v, i) => (
          <span key={i} className={DEMO_CELL[v]} />
        ))}
      </span>
    </div>
  )
}

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Luật chơi" onClose={onClose} className="rules-modal">
      <p className="rules-lead">
        <strong>Nonogram</strong> (còn gọi là Picross, Griddlers) là câu đố logic: dựa vào các con số ở đầu mỗi
        hàng và mỗi cột để tìm ra những ô cần tô. Tô đúng hết, một <strong>bức tranh</strong> sẽ hiện ra.
      </p>

      <figure className="demo">
        <DemoRow clue="3 1" cells={[1, 1, 1, 2, 1, 2, 0]} />
        <figcaption>
          Gợi ý <strong>3 1</strong>: một đoạn 3 ô liền nhau, sau đó (cách ít nhất 1 ô) là một đoạn 1 ô.
        </figcaption>
      </figure>

      <ol className="rules-steps">
        <li>
          <span className="rules-num">1</span>
          <div>
            <strong>Đọc gợi ý.</strong> Mỗi số là độ dài một đoạn ô tô liền nhau, theo đúng thứ tự từ trái sang phải
            (hàng) hoặc từ trên xuống dưới (cột). Số <strong>0</strong> nghĩa là cả hàng trống.
          </div>
        </li>
        <li>
          <span className="rules-num">2</span>
          <div>
            <strong>Giữa hai đoạn</strong> luôn có ít nhất một ô trống.
          </div>
        </li>
        <li>
          <span className="rules-num">3</span>
          <div>
            <strong>Tô và đánh dấu.</strong> Chạm vào ô để tô, giữ và kéo để tô cả dãy. Chọn công cụ{' '}
            <strong>Đánh dấu</strong> (hoặc bấm chuột phải) để gạch × những ô chắc chắn trống.
          </div>
        </li>
        <li>
          <span className="rules-num">4</span>
          <div>
            <strong>Về đích.</strong> Tô đúng mọi ô cần tô trước khi hết giờ là chiến thắng — dấu × không bắt buộc.
          </div>
        </li>
      </ol>

      <div className="rules-tip">
        <Icon name="hint" size={22} />
        <div>
          <strong>Bí quyết chồng lấn</strong>
          <p>
            Hàng 10 ô có gợi ý <strong>7</strong>: dù đặt đoạn 7 ô ở đâu, 4 ô ở giữa luôn bị phủ — tô ngay được!
          </p>
          <DemoRow clue="7" cells={[0, 0, 0, 3, 3, 3, 3, 0, 0, 0]} />
          <p>
            Mọi câu đố trong game đều có <strong>đúng một lời giải</strong> và giải được hoàn toàn bằng suy luận từng
            hàng, từng cột — không cần đoán. Số nào đã xong sẽ mờ đi, hàng/cột khớp gợi ý sẽ chuyển màu xanh.
          </p>
        </div>
      </div>

      <div className="rules-scoring">
        <strong>Đánh giá sao</strong>
        <p>
          Hoàn thành được 3 sao, trừ 1 sao nếu dùng gợi ý và trừ 1 sao nếu mắc từ 3 lỗi trở lên. Lỗi chỉ được đếm khi
          bật <em>Báo lỗi ngay</em> trong Cài đặt.
        </p>
      </div>

      <div className="rules-keys">
        <strong>Phím tắt</strong>
        <dl>
          {SHORTCUTS.map(([keys, what]) => (
            <div key={what}>
              <dt>
                {keys.map((k, i) => (
                  <span key={k}>
                    {i > 0 && ' '}
                    <kbd>{k}</kbd>
                  </span>
                ))}
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </div>

      <footer className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Đã hiểu, chơi thôi!
        </button>
      </footer>
    </Modal>
  )
}
