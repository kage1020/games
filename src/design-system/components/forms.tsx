import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  useId,
} from "react";
import { cx, useControlled } from "../internal.ts";
import { normalizeOptions, type Option } from "./navigation.tsx";

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

function FieldMessages({ id, hint, error }: { id: string } & FieldProps) {
  return (
    <>
      {error ? (
        <p className="kg-field-error" id={`${id}-err`}>
          <span className="kg-field-error-tag">エラー</span>
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="kg-field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </>
  );
}

function describedBy(id: string, { hint, error }: FieldProps): string | undefined {
  return (
    [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined
  );
}

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix">,
    FieldProps {
  prefix?: ReactNode;
  mono?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** ラベル・ヒント・エラーを 1 つにまとめた 1 行入力 */
export function Input({ label, hint, error, prefix, mono, className, id, ...rest }: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={cx("kg-field", error ? "is-error" : null, className)}>
      {label ? (
        <label className="kg-field-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div className="kg-field-box">
        {prefix ? (
          <span className="kg-field-prefix" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        <input
          className={cx("kg-field-input", mono && "is-mono")}
          {...rest}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, { hint, error })}
        />
      </div>
      <FieldMessages id={inputId} hint={hint} error={error} />
    </div>
  );
}

export interface RadioGroupProps {
  legend?: ReactNode;
  options: Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  className?: string;
}

/** 少数の選択肢から 1 つ選ぶ。必ずどれかを選んだ状態から始める */
export function RadioGroup({
  legend,
  options,
  value,
  defaultValue,
  onChange,
  name,
  className,
}: RadioGroupProps) {
  const auto = useId();
  const items = normalizeOptions(options);
  const [current, setCurrent] = useControlled(
    value,
    defaultValue ?? items[0]?.value ?? "",
    onChange,
  );
  return (
    <fieldset className={cx("kg-radio-group", className)}>
      {legend ? <legend className="kg-field-label">{legend}</legend> : null}
      {items.map((item) => (
        <label className="kg-check" key={item.value}>
          <input
            type="radio"
            name={name ?? auto}
            value={item.value}
            checked={current === item.value}
            onChange={() => setCurrent(item.value)}
            className="kg-check-input"
          />
          <span className="kg-radio-dot" aria-hidden="true" />
          <span className="kg-check-text">
            <span className="kg-check-label">{item.label}</span>
            {item.description ? <span className="kg-check-desc">{item.description}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export interface SliderProps {
  label: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** 右上に出す値の言い方 */
  format?: (value: number) => ReactNode;
  className?: string;
}

/** 連続した値を選ぶ。動かした瞬間に反映する */
export function Slider({
  label,
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onChange,
  format,
  className,
}: SliderProps) {
  const id = useId();
  const [current, setCurrent] = useControlled(value, defaultValue ?? min, onChange);
  const percent = ((current - min) / (max - min)) * 100;
  return (
    <div className={cx("kg-slider", className)}>
      <div className="kg-slider-head">
        <label className="kg-field-label" htmlFor={id}>
          {label}
        </label>
        <output className="kg-slider-value" htmlFor={id}>
          {format ? format(current) : current}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        className="kg-range"
        style={{ "--kg-range-pct": `${percent}%` } as CSSProperties}
        onChange={(event) => setCurrent(Number(event.target.value))}
      />
    </div>
  );
}

export interface ToggleProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "disabled"> {
  label: string;
  pressedLabel?: string;
  icon?: ReactNode;
  pressedIcon?: ReactNode;
  iconOnly?: boolean;
  pressed?: boolean;
  defaultPressed?: boolean;
  onChange?: (pressed: boolean) => void;
}

/** 押すたびにオン/オフが切り替わるボタン。オンは fill の面 */
export function Toggle({
  label,
  pressedLabel,
  icon,
  pressedIcon,
  iconOnly,
  pressed,
  defaultPressed = false,
  onChange,
  className,
  ...rest
}: ToggleProps) {
  const [on, setOn] = useControlled(pressed, defaultPressed, onChange);
  const text = on && pressedLabel ? pressedLabel : label;
  return (
    <button
      type="button"
      {...rest}
      aria-pressed={on}
      className={cx("kg-btn", "kg-btn-outline", "kg-toggle", iconOnly && "kg-btn-icon", className)}
      onClick={() => setOn(!on)}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      {icon ? (
        <span className="kg-icon" aria-hidden="true">
          {on && pressedIcon ? pressedIcon : icon}
        </span>
      ) : null}
      {iconOnly ? null : text}
    </button>
  );
}
