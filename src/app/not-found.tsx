import Link from "next/link";
import { FamilyHeader } from "@/components/FamilyHeader";

export default function NotFound() {
  return <main className="not-found-shell"><FamilyHeader /><section><p className="eyebrow">404 / NOT FOUND</p><h1>This path is not part of LifePot.</h1><Link className="primary-button" href="/">Return to Configure</Link></section></main>;
}
