import React, { useRef, useEffect } from 'react';
import { Star, Quote } from 'lucide-react';

const Testimonials: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const reviews = [
    {
      name: "Michael R.",
      role: "Plumbing Contractor",
      location: "Loganville, GA",
      text: "We went from 5 calls a week to 5 calls a day. The website rebuild completely changed how customers perceive us.",
      rating: 5
    },
    {
      name: "Sarah Jenkins",
      role: "Real Estate Broker",
      location: "Lawrenceville, GA",
      text: "The JetViz tool showed me exactly why I was losing leads. The new design is stunning and mobile-perfect.",
      rating: 5
    },
    {
      name: "Dr. Alan T.",
      role: "Chiropractor",
      location: "Snellville, GA",
      text: "Finally a web team that understands SEO. We are ranking #1 for our main keywords after just 3 months.",
      rating: 5
    },
    {
      name: "Elena Rodriguez",
      role: "HVAC Business Owner",
      location: "Monroe, GA",
      text: "The AI receptionist catches calls when my team is busy. It's like having an extra employee for free.",
      rating: 5
    },
    {
      name: "David Chen",
      role: "Law Firm Partner",
      location: "Suwanee, GA",
      text: "Professional, fast, and data-driven. They didn't just build a site, they built a lead generation asset.",
      rating: 5
    },
    {
      name: "Marcus W.",
      role: "Roofing Specialist",
      location: "Buford, GA",
      text: "Our old site looked like 2010. The new one converts visitors into appointments instantly. Highly recommend.",
      rating: 5
    },
    {
      name: "Jessica P.",
      role: "MedSpa Director",
      location: "Athens, GA",
      text: "The visual transformation was incredible. Clients constantly compliment our new booking experience.",
      rating: 5
    }
  ];

  // Auto-scroll animation logic
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationId: number;
    let startTimestamp: number | null = null;
    const speed = 0.5; // Pixels per frame

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      
      if (scrollContainer) {
        if (scrollContainer.scrollLeft >= (scrollContainer.scrollWidth / 2)) {
          scrollContainer.scrollLeft = 0;
        } else {
          scrollContainer.scrollLeft += speed;
        }
      }
      
      animationId = window.requestAnimationFrame(step);
    };

    animationId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <section className="py-24 bg-slate-50 border-y border-slate-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12 text-center">
        <h2 className="text-3xl md:text-4xl font-serif text-slate-900 mb-4">Trusted by Local Leaders</h2>
        <div className="flex justify-center items-center gap-2 text-amber-500 mb-2">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-current" />)}
        </div>
        <p className="text-slate-500">Real results from business owners in your area.</p>
      </div>

      {/* Scrolling Container */}
      <div 
        ref={scrollRef}
        className="flex gap-6 overflow-x-hidden w-full py-4"
        style={{ width: '100%' }}
      >
        {/* Double the list to create infinite loop effect */}
        {[...reviews, ...reviews].map((review, idx) => (
          <div 
            key={idx}
            className="flex-shrink-0 w-[350px] md:w-[400px] bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex gap-1 mb-4 text-amber-400">
                {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                ))}
            </div>
            <p className="text-slate-700 leading-relaxed mb-6 italic relative">
                <span className="text-indigo-200 text-4xl absolute -top-4 -left-2">"</span>
                <span className="relative z-10">{review.text}</span>
            </p>
            <div className="flex items-center gap-3 border-t border-slate-50 pt-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">
                    {review.name.charAt(0)}
                </div>
                <div>
                    <div className="font-bold text-slate-900 text-sm">{review.name}</div>
                    <div className="text-slate-400 text-xs">{review.role} • {review.location}</div>
                </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Testimonials;
