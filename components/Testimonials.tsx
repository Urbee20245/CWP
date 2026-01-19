import React, { useRef, useEffect } from 'react';
import { Star, Quote, MapPin } from 'lucide-react';

const Testimonials: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const reviews = [
    {
      name: "Michael R.",
      role: "Plumbing Contractor",
      location: "Atlanta, GA",
      text: "We went from 5 calls a week to 5 calls a day. The website rebuild completely changed how customers perceive us.",
      rating: 5,
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      name: "Sarah Jenkins",
      role: "Real Estate Broker",
      location: "Lawrenceville, GA",
      text: "The JetViz tool showed me exactly why I was losing leads. The new design is stunning and mobile-perfect.",
      rating: 5,
      gradient: "from-purple-500 to-pink-500"
    },
    {
      name: "Dr. Alan T.",
      role: "Chiropractor",
      location: "Snellville, GA",
      text: "Finally a web team that understands SEO. We are ranking #1 for our main keywords after just 3 months.",
      rating: 5,
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      name: "Elena Rodriguez",
      role: "HVAC Business Owner",
      location: "Monroe, GA",
      text: "The AI receptionist catches calls when my team is busy. It's like having an extra employee for free.",
      rating: 5,
      gradient: "from-orange-500 to-amber-500"
    },
    {
      name: "David Chen",
      role: "Law Firm Partner",
      location: "Suwanee, GA",
      text: "Professional, fast, and data-driven. They didn't just build a site, they built a lead generation asset.",
      rating: 5,
      gradient: "from-indigo-500 to-violet-500"
    },
    {
      name: "Marcus W.",
      role: "Roofing Specialist",
      location: "Buford, GA",
      text: "Our old site looked like 2010. The new one converts visitors into appointments instantly. Highly recommend.",
      rating: 5,
      gradient: "from-red-500 to-rose-500"
    },
    {
      name: "Jessica P.",
      role: "MedSpa Director",
      location: "Athens, GA",
      text: "The visual transformation was incredible. Clients constantly compliment our new booking experience.",
      rating: 5,
      gradient: "from-fuchsia-500 to-purple-500"
    }
  ];

  // Auto-scroll animation logic
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationId: number;
    const speed = 0.8; // Slightly faster for smoother feel

    const step = () => {
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
    <section className="py-24 bg-slate-50 border-y border-slate-200 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-100/50 via-slate-50 to-slate-50"></div>

      <div className="max-w-7xl mx-auto px-6 mb-16 text-center relative z-10">
        <h2 className="text-3xl md:text-5xl font-serif text-slate-900 mb-6 font-bold">Trusted by Local Leaders</h2>
        <div className="flex justify-center items-center gap-2 mb-4">
            <div className="flex gap-1">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-6 h-6 text-amber-400 fill-amber-400 drop-shadow-sm" />)}
            </div>
            <span className="text-slate-400 font-bold text-lg ml-2">5.0/5.0</span>
        </div>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            We don't just build websites; we build business assets. See what business owners in Atlanta and the Metro area have to say.
        </p>
      </div>

      {/* Scrolling Container */}
      <div className="relative w-full">
        {/* Gradient Masks for edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-slate-50 to-transparent z-20 pointer-events-none hidden md:block"></div>
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-slate-50 to-transparent z-20 pointer-events-none hidden md:block"></div>

        <div 
            ref={scrollRef}
            className="flex gap-8 overflow-x-hidden w-full py-10 px-4 items-stretch"
            style={{ width: '100%', whiteSpace: 'nowrap' }}
        >
            {/* Double the list to create infinite loop effect */}
            {[...reviews, ...reviews].map((review, idx) => (
            <div 
                key={idx}
                className="flex-shrink-0 w-[350px] md:w-[450px] bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-300 transform hover:-translate-y-2 group whitespace-normal"
            >
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-1">
                        {[...Array(review.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ))}
                    </div>
                    <Quote className="w-8 h-8 text-indigo-100 fill-indigo-50" />
                </div>

                <p className="text-slate-700 text-lg leading-relaxed mb-8 italic relative font-medium">
                    "{review.text}"
                </p>

                <div className="flex items-center gap-4 mt-auto">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${review.gradient} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                        {review.name.charAt(0)}
                    </div>
                    <div>
                        <div className="font-bold text-slate-900 text-base">{review.name}</div>
                        <div className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                            <span className="font-semibold text-indigo-600">{review.role}</span>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {review.location}</span>
                        </div>
                    </div>
                </div>
            </div>
            ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;