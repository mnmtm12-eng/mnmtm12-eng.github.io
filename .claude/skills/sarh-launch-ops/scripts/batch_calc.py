#!/usr/bin/env python3
"""SARH batch calculator: oil/ethanol quantities, cost per bottle, margin, maceration date.

Example:
    python3 batch_calc.py --bottles 100 --ml 50 --concentration 25 \
        --oil-cost-per-kg 180 --ethanol-cost-per-l 6 \
        --bottle-cost 1.8 --cap-cost 0.5 --box-cost 1.2 --label-cost 0.3 --price 35
"""
import argparse
from datetime import date, datetime, timedelta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bottles", type=int, required=True)
    ap.add_argument("--ml", type=float, required=True, help="bottle size ml")
    ap.add_argument("--concentration", type=float, required=True, help="oil %% (e.g. 25)")
    ap.add_argument("--oil-cost-per-kg", type=float, default=0)
    ap.add_argument("--oil-density", type=float, default=0.93, help="g/ml")
    ap.add_argument("--ethanol-cost-per-l", type=float, default=0)
    ap.add_argument("--bottle-cost", type=float, default=0)
    ap.add_argument("--cap-cost", type=float, default=0)
    ap.add_argument("--box-cost", type=float, default=0)
    ap.add_argument("--label-cost", type=float, default=0)
    ap.add_argument("--other-cost", type=float, default=0, help="per bottle")
    ap.add_argument("--price", type=float, default=0, help="selling price per bottle")
    ap.add_argument("--overfill", type=float, default=5, help="loss margin %%")
    ap.add_argument("--maceration-weeks", type=float, default=4)
    ap.add_argument("--start", default=str(date.today()))
    args = ap.parse_args()

    loss = 1 + args.overfill / 100
    liquid_ml = args.bottles * args.ml * loss
    oil_ml = liquid_ml * args.concentration / 100
    oil_g = oil_ml * args.oil_density
    ethanol_ml = liquid_ml - oil_ml

    oil_cost = (oil_g / 1000) * args.oil_cost_per_kg
    ethanol_cost = (ethanol_ml / 1000) * args.ethanol_cost_per_l
    packaging_per = args.bottle_cost + args.cap_cost + args.box_cost + args.label_cost + args.other_cost
    liquid_per = (oil_cost + ethanol_cost) / args.bottles
    cost_per = liquid_per + packaging_per
    total_cost = cost_per * args.bottles

    start = datetime.strptime(args.start, "%Y-%m-%d").date()
    ready = start + timedelta(weeks=args.maceration_weeks)

    print(f"=== SARH batch: {args.bottles} x {args.ml:.0f} ml @ {args.concentration:.0f}% "
          f"(overfill {args.overfill:.0f}%) ===")
    print(f"Liquid to blend : {liquid_ml:,.0f} ml")
    print(f"Perfume oil     : {oil_ml:,.0f} ml = {oil_g:,.0f} g "
          f"({oil_g / 1000:.2f} kg, density {args.oil_density})")
    print(f"Ethanol (96%)   : {ethanol_ml:,.0f} ml = {ethanol_ml / 1000:.2f} L")
    print(f"Maceration      : {args.maceration_weeks:g} weeks -> ready {ready}")
    print("--- cost per bottle ---")
    print(f"liquid {liquid_per:,.2f} | packaging {packaging_per:,.2f} | TOTAL {cost_per:,.2f}")
    print(f"Batch total cost: {total_cost:,.2f}")
    if args.price:
        margin = (args.price - cost_per) / args.price * 100
        profit = (args.price - cost_per) * args.bottles
        print(f"Price {args.price:,.2f} -> margin {margin:.1f}% | "
              f"batch revenue {args.price * args.bottles:,.2f} | profit {profit:,.2f}")


if __name__ == "__main__":
    main()
