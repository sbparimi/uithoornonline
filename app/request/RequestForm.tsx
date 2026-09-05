'use client';

import { ArrowRight, Check } from 'lucide-react';

export default function RequestForm() {
  return (
    <form className="request-form" onSubmit={(e) => e.preventDefault()}>
      <label>
        Waarmee kunnen we helpen?
        <textarea required placeholder="Bijvoorbeeld: Ik zoek iemand voor tuinonderhoud…" />
      </label>
      <label>
        Postcode
        <input inputMode="numeric" placeholder="1421AB" />
      </label>
      <label>
        Wanneer heb je hulp nodig?
        <select defaultValue="">
          <option value="" disabled>Selecteer een optie</option>
          <option>Deze week</option>
          <option>Deze maand</option>
          <option>Later</option>
        </select>
      </label>
      <button className="primary" type="submit">
        Aanvraag starten <ArrowRight />
      </button>
      <small>In deze eerste versie wordt je aanvraag nog niet gepubliceerd.</small>
    </form>
  );
}
