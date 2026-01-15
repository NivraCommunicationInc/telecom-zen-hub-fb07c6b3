import React from "react";

// Real Quebec province SVG path based on actual geographic boundaries
export const QuebecMapSVG: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <g className={className}>
      {/* Quebec Province - Realistic outline */}
      <path
        d="M 180 485 
           L 185 480 L 195 478 L 210 475 L 225 470 L 240 468 
           L 255 465 L 265 460 L 275 455 L 285 448 L 295 440
           L 305 432 L 312 425 L 318 418 L 322 410 L 325 400
           L 330 388 L 338 375 L 345 362 L 352 348 L 358 335
           L 362 320 L 365 305 L 368 290 L 372 275 L 378 260
           L 385 248 L 392 238 L 400 228 L 410 218 L 420 210
           L 432 202 L 445 195 L 458 188 L 472 182 L 488 178
           L 505 175 L 522 172 L 540 170 L 558 168 L 575 165
           L 590 160 L 602 155 L 612 148 L 620 140 L 628 130
           L 635 118 L 642 105 L 650 92 L 660 80 L 672 70
           L 685 62 L 700 55 L 718 50 L 738 48 L 758 50
           L 775 55 L 790 62 L 802 72 L 812 85 L 820 100
           L 825 118 L 828 138 L 830 158 L 832 178 L 835 198
           L 840 218 L 848 235 L 858 250 L 870 262 L 882 272
           L 892 280 L 900 285 L 905 288 L 908 290 L 910 292
           L 905 295 L 898 300 L 890 308 L 882 318 L 875 330
           L 870 342 L 868 355 L 868 368 L 870 380 L 875 392
           L 882 402 L 890 410 L 898 415 L 905 418 L 910 420
           L 908 425 L 902 432 L 895 442 L 888 455 L 882 470
           L 878 488 L 875 508 L 872 528 L 868 548 L 862 565
           L 855 580 L 845 592 L 832 602 L 818 610 L 802 618
           L 785 625 L 768 632 L 752 640 L 738 650 L 725 662
           L 715 675 L 708 688 L 702 702 L 698 715 L 695 728
           L 692 740 L 688 752 L 682 762 L 675 770 L 665 778
           L 652 785 L 638 790 L 622 795 L 605 800 L 588 805
           L 572 812 L 558 820 L 545 830 L 535 842 L 528 855
           L 522 868 L 518 880 L 515 892 L 512 902 L 508 910
           L 502 918 L 495 925 L 485 932 L 472 938 L 458 942
           L 442 945 L 425 948 L 408 952 L 392 958 L 378 965
           L 365 975 L 355 988 L 348 1002 L 342 1018 L 338 1035
           L 335 1052 L 330 1068 L 322 1082 L 312 1095 L 300 1105
           L 285 1112 L 268 1118 L 250 1122 L 232 1125 L 215 1128
           L 200 1132 L 188 1138 L 178 1148 L 172 1160 L 168 1175
           L 165 1192 L 162 1210 L 158 1228 L 152 1245 L 145 1260
           L 135 1272 L 122 1282 L 108 1290 L 92 1295 L 75 1298
           L 58 1300 L 42 1298 L 28 1292 L 18 1282 L 12 1268
           L 10 1252 L 12 1235 L 18 1218 L 28 1202 L 40 1188
           L 55 1175 L 72 1165 L 90 1158 L 108 1152 L 125 1145
           L 140 1135 L 152 1122 L 160 1108 L 165 1092 L 168 1075
           L 170 1058 L 172 1040 L 175 1022 L 180 1005 L 188 990
           L 198 978 L 210 968 L 225 960 L 242 952 L 258 945
           L 272 935 L 282 922 L 290 908 L 295 892 L 298 875
           L 300 858 L 302 840 L 305 822 L 310 805 L 318 790
           L 328 778 L 342 768 L 358 760 L 375 755 L 392 752
           L 408 748 L 422 742 L 432 732 L 440 720 L 445 705
           L 448 690 L 450 675 L 452 660 L 455 645 L 460 632
           L 468 620 L 478 610 L 490 602 L 502 595 L 515 590
           L 528 585 L 540 578 L 550 568 L 558 555 L 562 540
           L 565 525 L 568 510 L 572 495 L 578 482 L 588 472
           L 600 465 L 615 460 L 632 455 L 648 450 L 662 442
           L 672 432 L 678 418 L 682 402 L 685 385 L 688 368
           L 692 352 L 698 338 L 708 328 L 720 320 L 735 315
           L 752 312 L 768 308 L 782 302 L 792 292 L 798 278
           L 800 262 L 798 245 L 792 230 L 782 218 L 770 210
           L 755 205 L 738 202 L 720 200 L 702 198 L 685 195
           L 670 190 L 658 182 L 648 172 L 642 160 L 638 145
           L 635 130 L 630 118 L 622 108 L 610 100 L 595 95
           L 578 92 L 560 90 L 542 88 L 525 85 L 510 80
           L 498 72 L 488 62 L 480 50 L 472 38 L 462 28
           L 450 20 L 435 15 L 418 12 L 400 10 L 382 10
           L 365 12 L 350 18 L 338 28 L 328 42 L 322 58
           L 318 75 L 315 92 L 312 110 L 308 128 L 302 145
           L 292 160 L 280 172 L 265 182 L 248 190 L 230 198
           L 212 208 L 198 220 L 188 235 L 182 252 L 178 270
           L 175 288 L 172 308 L 168 328 L 162 348 L 155 365
           L 145 380 L 132 392 L 118 402 L 102 412 L 88 422
           L 78 435 L 72 450 L 70 468 L 72 485 L 78 500
           L 88 512 L 102 522 L 118 530 L 135 535 L 152 538
           L 168 540 L 182 538 L 195 532 L 205 522 L 212 510
           L 215 495 L 215 480 L 210 468 L 200 458 L 188 452
           L 175 450 L 162 452 L 152 458 L 145 468 L 142 480
           L 145 492 L 152 502 L 162 508 L 175 510 L 188 505
           L 198 495 L 202 482 L 200 468 L 192 458 L 180 455
           L 170 458 L 165 468 L 168 480 L 178 488 L 180 485
           Z"
        fill="url(#quebecGradient)"
        stroke="hsl(var(--border))"
        strokeWidth="2"
        className="transition-all duration-500"
      />
      
      {/* St. Lawrence River */}
      <path
        d="M 180 540 Q 250 535, 320 520 T 450 490 T 580 460 T 700 420"
        fill="none"
        stroke="hsl(var(--primary)/0.3)"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.4"
      />
      
      {/* Northern territories boundary */}
      <path
        d="M 75 1300 L 910 292"
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="1"
        strokeDasharray="8 4"
        opacity="0.3"
      />
    </g>
  );
};

export const QuebecMapDefs: React.FC = () => {
  return (
    <defs>
      {/* Quebec land gradient */}
      <linearGradient id="quebecGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.6" />
        <stop offset="50%" stopColor="hsl(var(--muted))" stopOpacity="0.4" />
        <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.2" />
      </linearGradient>
      
      {/* Glow effect for active points */}
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      
      {/* Pulse animation filter */}
      <filter id="pulse-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.5" result="color"/>
        <feComposite in="color" in2="blur" operator="in" result="shadow"/>
        <feMerge>
          <feMergeNode in="shadow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      {/* Drop shadow */}
      <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
  );
};
