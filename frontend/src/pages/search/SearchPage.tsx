import React, { useState, useEffect } from 'react';
import { searchService } from '../../services/search.service';
import type { SearchResultItem } from '../../services/search.service';
import { PageHeader } from '../../components/ui/PageHeader';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Search, Scale, ShieldCheck, ClipboardCheck, Award, AlertOctagon, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('');
  const [city, setCity] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await searchService.search({
        query: query.trim() || undefined,
        entityType: entityType || undefined,
        city: city.trim() || undefined,
        limit: 50
      });
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setHasSearched(true);
    searchService
      .search({ limit: 50 })
      .then((data) => {
        if (active) setResults(data.results || []);
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'INSTRUMENT':
        return <Scale className="w-5 h-5 text-teal-400" />;
      case 'INSPECTION':
        return <ShieldCheck className="w-5 h-5 text-purple-400" />;
      case 'VERIFICATION':
        return <ClipboardCheck className="w-5 h-5 text-sky-400" />;
      case 'CERTIFICATE':
        return <Award className="w-5 h-5 text-emerald-400" />;
      case 'NOTICE':
        return <AlertOctagon className="w-5 h-5 text-amber-400" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  const getEntityLink = (item: SearchResultItem) => {
    switch (item.entityType) {
      case 'INSTRUMENT':
        return `/passport/${item.id}`;
      case 'INSPECTION':
        return `/inspections`;
      case 'VERIFICATION':
        return `/verifications`;
      case 'CERTIFICATE':
        return `/certificates`;
      case 'NOTICE':
        return `/notices`;
      case 'COMPLAINT':
        return `/complaints`;
      default:
        return `/dashboard`;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Statutory Search"
        subtitle="Unified role-scoped search engine across instruments, inspections, verifications, certificates, and notices."
      />

      {/* Search Input Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search serial numbers, models, certificates, cities..."
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-11 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-medium"
            />
          </div>

          <div className="flex gap-3">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="">All Entities</option>
              <option value="INSTRUMENT">Instruments</option>
              <option value="INSPECTION">Inspections</option>
              <option value="VERIFICATION">Verifications</option>
              <option value="CERTIFICATE">Certificates</option>
              <option value="NOTICE">Notices</option>
              <option value="COMPLAINT">Complaints</option>
            </select>

            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City filter"
              className="bg-slate-950 border border-slate-700 rounded-2xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500 w-32"
            />

            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-bold text-white transition-colors shrink-0 shadow-lg"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* Search Results Display */}
      {isLoading ? (
        <LoadingState message="Searching statutory records..." />
      ) : results.length === 0 && hasSearched ? (
        <EmptyState
          title="No Matching Records Found"
          description="Try broadening your search query or removing entity filters."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 font-medium px-1">
            Found <span className="text-teal-400 font-bold">{results.length}</span> matching record(s)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((item, idx) => (
              <div
                key={item.id || idx}
                className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-2xl p-4 transition-all space-y-2 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                      {getEntityIcon(item.entityType)}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-teal-400 uppercase font-bold block">
                        {item.entityType}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">{item.title}</h4>
                      <p className="text-xs text-slate-400">{item.subtitle}</p>
                    </div>
                  </div>
                  {item.status && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                      {item.status}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}
                  </span>
                  <Link
                    to={getEntityLink(item)}
                    className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1"
                  >
                    View Details &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
