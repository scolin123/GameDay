import { useEffect } from 'react';
import styles from './Toast.module.css';

export default function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className={styles.toast}>
      <span>{message}</span>
      <button onClick={onClose} className={styles.close}>x</button>
    </div>
  );
}
